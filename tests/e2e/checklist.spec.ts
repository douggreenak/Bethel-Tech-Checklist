import { test, expect, type Page } from "@playwright/test";

const PASSCODE = process.env.TEAM_PASSCODE || "churchtech2026";

// Authenticate via the real login form so that the session cookie is
// created by the server (correct secret, correct flags).
async function authenticate(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="password"]', PASSCODE);
  await page.click('button[type="submit"]');
  // Wait until redirected to the main page
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("h1")).toHaveText("Church tech checklist", {
    timeout: 20000,
  });
}

test.describe("Church Tech Checklist", () => {
  test("import page reports malformed JSON without mislabeling network errors", async ({ page }) => {
    await authenticate(page);
    await page.goto("/import");
    await expect(page.getByText("Drop your JSON backup here")).toBeVisible();
    await expect(page.locator("textarea")).toBeHidden();
    await page.getByText("Or paste JSON instead").click();
    await page.locator("textarea").fill("{not valid json");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.locator(".form-message.error")).toContainText("Invalid JSON");
  });

  test("accepts a JSON backup dropped onto the primary upload area", async ({ page }) => {
    await authenticate(page);
    await page.goto("/import");
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(
        ['{"categories":[],"tasks":[],"history":[]}'],
        "dropped-backup.json",
        { type: "application/json" }
      ));
      return transfer;
    });

    const dropzone = page.locator(".import-dropzone");
    await dropzone.dispatchEvent("dragenter", { dataTransfer });
    await expect(dropzone).toHaveClass(/is-dragging/);
    await dropzone.dispatchEvent("drop", { dataTransfer });

    await expect(dropzone).not.toHaveClass(/is-dragging/);
    await expect(page.locator(".import-file-hint")).toContainText("dropped-backup.json");
    await expect(page.locator("textarea")).toContainText('"categories":[]');
  });

  test("reduced motion disables decorative animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    const motion = await page.evaluate(() => {
      const button = document.createElement("button");
      button.className = "btn shake";
      document.body.append(button);
      const style = getComputedStyle(button);
      return { transitionDuration: style.transitionDuration, animationName: style.animationName };
    });

    expect(motion.transitionDuration).toBe("0s");
    expect(motion.animationName).toBe("none");
  });

  test("login page works with passcode and rejects invalid passcode", async ({ page }) => {
    await page.goto("/login");

    // Enter wrong passcode
    await page.fill('input[type="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Incorrect passcode")).toBeVisible();

    // Enter correct passcode
    await page.fill('input[type="password"]', PASSCODE);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("h1")).toHaveText("Church tech checklist", { timeout: 15000 });
  });

  test("add category and task, check it, see count badge and progress update", async ({ page }) => {
    await authenticate(page);

    const catName = "Auditorium " + Math.random().toString(36).slice(2, 6);
    await page.fill("#newCat", catName);
    await page.click("#addCatBtn");

    const catEl = page.locator(`section[data-cat]:has-text("${catName}")`);
    await expect(catEl).toBeVisible({ timeout: 10000 });

    const catId = await catEl.getAttribute("data-cat");
    expect(catId).toBeTruthy();

    await page.selectOption("#catSel", catId!);
    const taskName = "Adjust pulpit mic " + Math.random().toString(36).slice(2, 6);
    await page.fill("#newTask", taskName);
    await page.click("#addBtn");

    const taskRow = catEl.locator(`.row:has-text("${taskName}")`);
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    const badge = catEl.locator(".cnt");
    await expect(badge).toHaveText("0/1");

    const progressBefore = await page.locator("#txt").textContent();
    const progressMatch = progressBefore?.match(/^(\d+) of (\d+) done$/);
    expect(progressMatch).not.toBeNull();

    const checkbox = taskRow.locator('input[type="checkbox"]');
    await checkbox.check();

    await expect(taskRow).toHaveClass(/done/);
    await expect(badge).toContainText("1/1");
    await expect(badge).toHaveClass(/all/);
    const completed = Number(progressMatch![1]) + 1;
    const total = Number(progressMatch![2]);
    await expect(page.locator("#txt")).toHaveText(
      completed === total ? "✓ All done!" : `${completed} of ${total} done`
    );
  });

  test("checking a task does not move any other row (no layout shift)", async ({ page }) => {
    await authenticate(page);

    const idSuffix = Math.random().toString(36).slice(2, 6);
    const taskAName = `Task A ${idSuffix}`;
    const taskBName = `Task B ${idSuffix}`;

    await page.selectOption("#catSel", "general");
    await page.fill("#newTask", taskAName);
    await page.click("#addBtn");
    await page.fill("#newTask", taskBName);
    await page.click("#addBtn");

    const rowA = page.locator(`.row:has-text("${taskAName}")`);
    const rowB = page.locator(`.row:has-text("${taskBName}")`);
    await expect(rowA).toBeVisible({ timeout: 10000 });
    await expect(rowB).toBeVisible({ timeout: 10000 });
    await rowA.scrollIntoViewIfNeeded();

    const boxBefore = await rowB.boundingBox();
    expect(boxBefore).not.toBeNull();

    await rowA.locator('input[type="checkbox"]').check();
    await page.waitForTimeout(300);

    const boxAfter = await rowB.boundingBox();
    expect(boxAfter).not.toBeNull();

    expect(boxAfter!.y).toBe(boxBefore!.y);
    expect(boxAfter!.height).toBe(boxBefore!.height);
  });

  test("category auto-collapses after last task checked and re-expands on uncheck", async ({ page }) => {
    await authenticate(page);

    const catName = "Auto Collapse " + Math.random().toString(36).slice(2, 6);
    await page.fill("#newCat", catName);
    await page.click("#addCatBtn");

    const catEl = page.locator(`section[data-cat]:has-text("${catName}")`);
    await expect(catEl).toBeVisible({ timeout: 10000 });
    const catId = await catEl.getAttribute("data-cat");

    await page.selectOption("#catSel", catId!);
    await page.fill("#newTask", "Solo Task");
    await page.click("#addBtn");

    const taskRow = catEl.locator('.row:has-text("Solo Task")');
    await expect(taskRow).toBeVisible({ timeout: 10000 });
    await expect(catEl).not.toHaveClass(/collapsed/);

    await taskRow.locator('input[type="checkbox"]').check();

    await page.waitForTimeout(1200);
    await expect(catEl).toHaveClass(/collapsed/);

    await catEl.locator(".tog").click();
    await page.waitForTimeout(600);
    await expect(catEl).not.toHaveClass(/collapsed/);

    await taskRow.locator('input[type="checkbox"]').uncheck();
    await page.waitForTimeout(400);
    await expect(catEl).not.toHaveClass(/collapsed/);
  });

  test("Start new week shows dialog, confirms, archives and undo restores", async ({ page }) => {
    await authenticate(page);

    const taskName = "Reset Test " + Math.random().toString(36).slice(2, 6);
    await page.selectOption("#catSel", "general");
    await page.fill("#newTask", taskName);
    await page.click("#addBtn");

    const taskRow = page.locator(`.row:has-text("${taskName}")`);
    await expect(taskRow).toBeVisible({ timeout: 10000 });
    await taskRow.locator('input[type="checkbox"]').check();
    await expect(taskRow.locator('input[type="checkbox"]')).toBeChecked();

    await page.click("#reset");

    const modal = page.locator(".modal");
    await expect(modal).toBeVisible({ timeout: 8000 });
    await expect(modal.locator("h2")).toHaveText("Start a new week?");

    await modal.locator("#mYes, .mbtn .btn").click();

    await expect(taskRow.locator('input[type="checkbox"]')).not.toBeChecked({ timeout: 10000 });

    const toast = page.locator(".toast.on");
    await expect(toast).toContainText("New week started. Results saved.", { timeout: 10000 });

    await toast.locator("button:has-text('Undo')").click();
    await expect(taskRow.locator('input[type="checkbox"]')).toBeChecked({ timeout: 10000 });
  });

  test("past-due banner, start new week grace, and renew due times", async ({ page }) => {
    await authenticate(page);
    await page.request.post("/api/week/renew");

    // Create a dedicated category with dueDay=1 (Monday) and dueTime=00:01
    // Monday is always in the past by Tuesday–Saturday, guaranteeing overdue state.
    const dueCatName = "DueCat " + Math.random().toString(36).slice(2, 6);
    await page.fill("#newCat", dueCatName);
    await page.click("#addCatBtn");

    const dueCatEl = page.locator(`section[data-cat]:has-text("${dueCatName}")`);
    await expect(dueCatEl).toBeVisible({ timeout: 10000 });
    const dueCatId = await dueCatEl.getAttribute("data-cat");

    // Set category due_day=1 (Monday) and due_time=00:01 via API
    await page.request.patch(`/api/categories/${dueCatId}`, {
      data: { dueTime: "00:01", dueDay: 1 },
    });

    const lateTaskName = "Late Battery " + Math.random().toString(36).slice(2, 6);
    await page.selectOption("#catSel", dueCatId!);
    await page.fill("#newTask", lateTaskName);
    await page.click("#addBtn");

    const taskRow = page.locator(`.row:has-text("${lateTaskName}")`);
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    // Trigger a SWR revalidation so the banner picks up the new due info
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Church tech checklist", { timeout: 15000 });
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    const banner = page.locator(".ban");
    await expect(banner).toBeVisible({ timeout: 12000 });
    await expect(banner).toContainText("past due");

    // Check the task, start a new week → banner should disappear (grace period)
    await taskRow.locator('input[type="checkbox"]').check();
    await page.click("#reset");
    await page.locator(".mbtn .btn").click();

    await expect(banner).not.toBeVisible({ timeout: 10000 });

    // Renew due times → banner returns when task is unchecked
    await page.click("#renewBtn");
    await taskRow.locator('input[type="checkbox"]').uncheck();
    await expect(banner).toBeVisible({ timeout: 10000 });
  });

  test("theme mode and accent persist after reload without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // Filter out known-harmless hydration warnings in dev mode
        const text = msg.text();
        if (
          text.includes("hydrat") ||
          text.includes("Hydration") ||
          text.includes("did not match") ||
          text.includes("Warning:")
        ) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    await authenticate(page);

    // Scroll the appearance card into view if needed (it may be below the fold on phone)
    await page.locator("#seg").scrollIntoViewIfNeeded();
    await page.click('#seg button:has-text("Dark")');
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const sageSwatch = page.locator('.swrow button[aria-label*="Sage"]');
    await sageSwatch.scrollIntoViewIfNeeded();
    await sageSwatch.click();
    await expect(sageSwatch).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    // After reload, need to re-authenticate (cookie survives, page loads directly)
    await expect(page.locator("h1")).toHaveText("Church tech checklist", { timeout: 15000 });

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const reloadedSwatch = page.locator('.swrow button[aria-label*="Sage"]');
    await expect(reloadedSwatch).toHaveAttribute("aria-pressed", "true");

    expect(consoleErrors).toEqual([]);
  });

  test("drag a task between categories and persist after reload", async ({ page }) => {
    await authenticate(page);

    const catAlphaName = "Alpha " + Math.random().toString(36).slice(2, 6);
    const catBetaName = "Beta " + Math.random().toString(36).slice(2, 6);
    await page.fill("#newCat", catAlphaName);
    await page.click("#addCatBtn");
    await page.fill("#newCat", catBetaName);
    await page.click("#addCatBtn");

    const catAlpha = page.locator(`section[data-cat]:has-text("${catAlphaName}")`);
    const catBeta = page.locator(`section[data-cat]:has-text("${catBetaName}")`);
    await expect(catAlpha).toBeVisible({ timeout: 10000 });
    await expect(catBeta).toBeVisible({ timeout: 10000 });

    const alphaId = await catAlpha.getAttribute("data-cat");
    await page.selectOption("#catSel", alphaId!);
    const itemName = "Movable Item " + Math.random().toString(36).slice(2, 6);
    await page.fill("#newTask", itemName);
    await page.click("#addBtn");

    const taskRow = catAlpha.locator(`.row:has-text("${itemName}")`);
    await expect(taskRow).toBeVisible({ timeout: 10000 });

    const grip = taskRow.locator(".grip");
    await grip.scrollIntoViewIfNeeded();
    const gripBox = await grip.boundingBox();
    const betaHeadBox = await catBeta.locator(".cathead").boundingBox();

    expect(gripBox).not.toBeNull();
    expect(betaHeadBox).not.toBeNull();

    await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      betaHeadBox!.x + betaHeadBox!.width / 2,
      betaHeadBox!.y + betaHeadBox!.height / 2 + 30,
      { steps: 10 }
    );
    await page.mouse.up();

    await expect(catBeta.locator(`.row:has-text("${itemName}")`)).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.locator("h1")).toHaveText("Church tech checklist", { timeout: 15000 });
    const reloadedBeta = page.locator(`section[data-cat]:has-text("${catBetaName}")`);
    await expect(reloadedBeta.locator(`.row:has-text("${itemName}")`)).toBeVisible({ timeout: 10000 });
  });

  test("imports a versioned Church Tech Checklist backup and restores supported settings", async ({ page }) => {
    await authenticate(page);

    const suffix = Math.random().toString(36).slice(2, 8);
    const categoryId = `backup-${suffix}`;
    const taskId = `backup-task-${suffix}`;
    const backup = {
      format: "church-tech-checklist-backup",
      formatVersion: 1,
      exportedAt: "2026-10-31T21:59:25.348Z",
      source: { app: "Church Tech Checklist", storage: "account" },
      counts: { categories: 2, tasks: 1, history: 1 },
      fieldNotes: { "tasks.cat": "category id" },
      data: {
        categories: [
          { id: "general", name: "Auditorium", order: 10, due: "07:50", dueDay: null, builtIn: true },
          { id: categoryId, name: "Backup category", order: 20, due: "20:00", dueDay: null },
        ],
        tasks: [{
          id: taskId,
          text: "Imported task",
          done: true,
          cat: categoryId,
          order: 11,
          at: 1793333679073,
          due: "09:00",
          star: true,
        }],
        history: [{
          week: "2026-10-19",
          done: 1,
          total: 1,
          at: 1793333398246,
          detail: [{ n: "Backup category", d: 1, t: 1 }],
        }],
        appState: { week: "2026-10-26", startedAt: 1793333398247 },
      },
      settings: {
        shared: { defaultDueDay: 4 },
        device: {
          theme: { acc: 1 },
          collapsedCategories: { [categoryId]: true },
        },
      },
    };

    await page.goto("/import");
    await expect(page.getByText("Drop your JSON backup here")).toBeVisible();
    await expect(page.getByText("Or paste JSON instead")).toBeVisible();
    await page.locator("#backupFile").setInputFiles({
      name: "church-tech-checklist-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.locator(".import-file-hint")).toContainText(
      "church-tech-checklist-backup.json"
    );
    await expect(page.locator(".import-paste")).toHaveAttribute("open", "");
    await expect(page.locator("textarea")).toContainText("Imported task");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.locator(".form-message.success")).toContainText(
      "Imported 2 categories, 1 task, and 1 history record."
    );

    const importedState = await page.request.get("/api/state").then((response) => response.json());
    expect(importedState.categories.find((category: { id: string }) => category.id === categoryId).dueDay).toBe(4);
    expect(importedState.tasks.find((task: { id: string }) => task.id === taskId)).toMatchObject({
      done: true,
      categoryId,
      dueTime: "09:00",
      starred: true,
    });
    expect(importedState.history.some((entry: { week: string }) => entry.week === "2026-10-19")).toBe(true);
    expect(importedState.appState).toMatchObject({ currentWeek: "2026-10-26" });
    await expect.poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("church-tech-theme") || "{}"))
    ).toEqual({ acc: 1 });
    await expect.poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("church-tech-collapsed-v1") || "{}"))
    ).toEqual({ [categoryId]: true });
  });
});

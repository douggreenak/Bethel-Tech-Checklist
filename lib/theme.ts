export const ACCENTS: Array<[string, number, number]> = [
  ["Blue", 216, 85],
  ["Sage", 105, 28],
  ["Teal", 170, 28],
  ["Periwinkle", 235, 45],
  ["Terracotta", 20, 48],
  ["Lavender", 262, 30],
  ["Mauve", 320, 28],
  ["Gray", 210, 8],
];

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeConfig {
  mode?: ThemeMode;
  acc?: number;
  rl?: boolean; // rotation lock
}

export const THEME_STORAGE_KEY = "church-tech-theme";

export function getThemeProperties(accIndex: number, isDark: boolean): Record<string, string> {
  const accent = ACCENTS[accIndex] || ACCENTS[0];
  const h = accent[1];
  const sa = accent[2];
  const t = Math.min(sa + 10, 70);

  if (isDark) {
    const acc = `hsl(${h}, ${sa + 10}%, 78%)`;
    return {
      "--acc": acc,
      "--on": `hsl(${h}, ${sa}%, 16%)`,
      "--pc": `hsl(${h}, ${sa}%, 26%)`,
      "--opc": `hsl(${h}, ${sa}%, 90%)`,
      "--tr": `hsla(${h}, ${sa}%, 90%, .22)`,
      "--invp": `hsl(${h}, ${sa}%, 36%)`,
      "--ok": acc,
    };
  } else {
    const acc = `hsl(${h}, ${sa}%, 38%)`;
    return {
      "--acc": acc,
      "--on": "#fff",
      "--pc": `hsl(${h}, ${t}%, 82%)`,
      "--opc": `hsl(${h}, ${t}%, 14%)`,
      "--tr": `hsla(${h}, ${sa}%, 14%, .16)`,
      "--invp": `hsl(${h}, ${sa}%, 82%)`,
      "--ok": acc,
    };
  }
}

export function applyTheme(theme: ThemeConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const mode = theme.mode || "system";

  if (mode === "light" || mode === "dark") {
    root.setAttribute("data-theme", mode);
  } else {
    root.removeAttribute("data-theme");
  }

  const mm = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const isDark = mode === "dark" || (mode !== "light" && Boolean(mm && mm.matches));
  const props = getThemeProperties(theme.acc ?? 0, isDark);

  for (const [k, v] of Object.entries(props)) {
    root.style.setProperty(k, v);
  }
}

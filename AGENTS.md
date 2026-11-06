# Guidance for coding agents

- Keep changes scoped; inspect the relevant code and tests rather than scanning the whole repository.
- Run the narrowest useful validation first:
  - Logic/parser changes: `pnpm test -- tests/unit/<related-file>.test.ts`
  - UI behavior: `pnpm test:e2e:quick -- tests/e2e/checklist.spec.ts --grep "<test name>"`
  - TypeScript changes: `pnpm typecheck`
- The quick E2E command runs the selected tests on phone only and does not retry failures. Run `pnpm e2e` for full phone/tablet coverage when changing shared interactions, responsive behavior, or broad UI behavior.
- Run `pnpm build` when changing build/runtime configuration, dependencies, migrations, or deployment-critical code. Do not run it automatically for unrelated small edits.
- Keep all existing tests and checks; focused local validation is not a reason to weaken full-suite coverage.
- Do not deploy, change Vercel settings, or access production data unless explicitly requested.

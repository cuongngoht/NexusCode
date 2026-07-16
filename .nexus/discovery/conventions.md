# Coding Conventions

## File & Folder Naming

- **File naming:** PascalCase — Fact
- **Folder naming:** camelCase — Fact
- **Test files:** *.test.ts — Fact

## Class & Interface Naming

- **Interface prefix:** I-prefix (e.g. IFoo) — Inference
- **Abstract class prefix:** Base-prefix (e.g. BaseFoo) — Inference

## Module Structure

- **Barrel files (index.ts):** Yes — used widely — Fact

## i18n / Localization

- Translation files found: `src/webview-ui/i18n/en.json`, `src/webview-ui/i18n/i18n.test.ts`, `src/webview-ui/i18n/index.ts`, `src/webview-ui/i18n/vi.json` — Fact

## Error Handling

- Result/Either type — Inference

## Recommendations

- New files should match the detected naming convention.
- New interfaces should follow the detected prefix pattern.
- Export new modules via the nearest `index.ts` barrel.
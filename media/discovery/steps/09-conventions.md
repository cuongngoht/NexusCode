# Step 9: Conventions

## Goal
Infer the project's coding and structural conventions from evidence in the codebase.
Conventions help future agents produce consistent code without manual review.

## Areas to Investigate

### File & Folder Naming
- File case: `PascalCase.ts`, `camelCase.ts`, `kebab-case.ts`, `snake_case.py`?
- Folder case: `PascalCase/`, `kebab-case/`, `snake_case/`?
- Test file naming: `*.test.ts`, `*.spec.ts`, `test_*.py`, `*_test.go`?

### Module / Class Naming
- Interface prefix: `IFoo` vs `FooInterface` vs no prefix?
- Abstract class naming: `BaseFoo` vs `AbstractFoo`?
- Service naming: `FooService` vs `FooManager` vs `FooUseCase`?

### Import Style
- Absolute imports with path aliases (`@/`, `~/`, `#/`)?
- Relative imports only?
- Barrel files (`index.ts`) in each folder?

### Dependency Direction
- Outer layers import inner layers? (Clean Architecture rule)
- Any circular dependency evidence?

### Error Handling
- Result/Either types? (`Result<T, E>`, `Either`, `Option`)
- Exception-based?
- Mixed?

### i18n / Localization
- Translation files present? (`en.json`, locale files)
- Translation hook/function pattern? (`t('key')`, `useT()`, `gettext`)

### Configuration Files Location
- Inline in code, env vars, or dedicated config folder?

## Output Rules

Label every finding:
- **Fact:** "Found `*.test.ts` in 47 files — test naming convention confirmed"
- **Inference:** "All service files use `*Service` suffix in 12/14 cases — likely a convention"
- **Recommendation:** "New files should follow the same naming pattern"

## Writes

- Append key conventions to `conventionNotes`
- Write full findings to `.nexus/discovery/conventions.md` with Facts / Inferences / Recommendations sections

# Project Scripts & Toolchain

**Package Manager:** npm

## Canonical Commands

- **build**: `npm run compile:extension`
- **typecheck**: `npm run typecheck`
- **dev**: `npm run watch`
- **test**: `npm run test:webview`

## Custom Scripts

- `npm run vscode:prepublish` (vscode:prepublish)
- `npm run package:list` (package:list)
- `npm run package:vsix` (package:vsix)
- `npm run package:verify` (package:verify)
- `npm run verify:vsix` (verify:vsix)

## Recommended Validation Sequence

1. `npm run typecheck`
1. `npm run compile:extension`
1. `npm run test:webview`
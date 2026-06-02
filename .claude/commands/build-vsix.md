Build and install the Nexus Visual Code VS Code extension.

## Steps

1. Run `npm run compile` from the project root (`/Users/cuongngoht/Repo/NexusCode`).
   - This runs two sub-steps in sequence:
     - `compile:extension` — TypeScript → `out/` (extension host code)
     - `compile:webview` — Vite → `media/webview/main.js` (React + Fluent UI bundle)
   - If either step fails, show the errors and stop — do not proceed to packaging.

2. Run `npx @vscode/vsce package --no-dependencies` from the project root.
   This produces `nexus-visual-code-*.vsix`.

3. Find the generated `.vsix` file (glob `nexus-visual-code-*.vsix` in the project root).

4. Run `code --install-extension <vsix-path>` to install immediately — **do not ask, always install automatically**.
   Report the `.vsix` file path and size, then tell the user to reload VS Code (`Cmd+Shift+P` → `Developer: Reload Window`) then open **Nexus: Open Chat**.

## Notes
- Always run from the project root `/Users/cuongngoht/Repo/NexusCode`.
- Never skip the compile step — both TypeScript and Vite errors must be caught before packaging.
- The webview bundle (`media/webview/main.js`) must exist before packaging; it is produced by `compile:webview`.
- If `vsce` is not installed globally, `npx @vscode/vsce` handles it automatically.
- Bundle size of `media/webview/main.js` is ~415 kB raw / ~124 kB gzip — this is expected from Fluent UI v9.

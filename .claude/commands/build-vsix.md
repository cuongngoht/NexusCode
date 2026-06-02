Build and optionally install the Nexus Visual Code VS Code extension.

## Steps

1. Run `npm run compile` from the project root (`/Users/cuongngoht/Repo/NexusCode`). If it fails, show the TypeScript errors and stop — do not proceed to packaging.

2. Run `npx @vscode/vsce package --no-dependencies` from the project root. This produces `nexus-visual-code-*.vsix`.

3. Find the generated `.vsix` file (glob `nexus-visual-code-*.vsix` in the project root).

4. Ask the user: **"Install the extension into VS Code now?"**
   - If yes: run `code --install-extension <vsix-path>` and tell them to reload VS Code (`Cmd+Shift+P` → `Developer: Reload Window`), then open `Nexus: Open Chat`.
   - If no: just report the path to the `.vsix` file and remind them they can install later with `code --install-extension <vsix-path>`.

## Notes
- Always run from the project root `/Users/cuongngoht/Repo/NexusCode`.
- Do not skip the compile step even if source looks unchanged — TypeScript errors must be caught before packaging.
- If `vsce` is not installed globally, `npx @vscode/vsce` handles it automatically.

import { webDarkTheme, webLightTheme, type Theme } from '@fluentui/react-components';

export function getBaseTheme(): Theme {
  if (
    document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast')
  ) {
    return webDarkTheme;
  }
  return webLightTheme;
}

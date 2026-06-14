export function normalizeProviderAlias(input: string): string {
  const value = input.trim().toLowerCase();
  if (value === 'agy' || value === 'antigravity' || value === 'gemini') return 'antigravity';
  return value;
}

export function normalizeProviderRoute(input: string): string {
  return input
    .split(/[+,>]/)
    .map(part => normalizeProviderAlias(part))
    .filter(Boolean)
    .join('+');
}

export function displayProviderRoute(route: string): string {
  return route
    .split('+')
    .map(id => id === 'antigravity' ? 'agy' : id)
    .join(' -> ');
}

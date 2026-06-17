import { describe, it, expect } from 'vitest';
import enMessages from './en.json';
import viMessages from './vi.json';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('i18n key sync', () => {
  it('en.json and vi.json have identical key sets', () => {
    const enKeys = new Set(collectKeys(enMessages as Record<string, unknown>));
    const viKeys = new Set(collectKeys(viMessages as Record<string, unknown>));

    const missingInVi = [...enKeys].filter(k => !viKeys.has(k));
    const missingInEn = [...viKeys].filter(k => !enKeys.has(k));

    if (missingInVi.length > 0) {
      console.error('Keys in en.json but missing in vi.json:', missingInVi);
    }
    if (missingInEn.length > 0) {
      console.error('Keys in vi.json but missing in en.json:', missingInEn);
    }

    expect(missingInVi).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it('en.json has no empty string values', () => {
    const enKeys = collectKeys(enMessages as Record<string, unknown>);
    const emptyKeys = enKeys.filter(path => {
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let val: any = enMessages;
      for (const p of parts) val = val?.[p];
      return val === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  it('vi.json has no empty string values', () => {
    const viKeys = collectKeys(viMessages as Record<string, unknown>);
    const emptyKeys = viKeys.filter(path => {
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let val: any = viMessages;
      for (const p of parts) val = val?.[p];
      return val === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  it('both files have the same number of leaf keys', () => {
    const enKeys = collectKeys(enMessages as Record<string, unknown>);
    const viKeys = collectKeys(viMessages as Record<string, unknown>);
    expect(enKeys.length).toBe(viKeys.length);
  });

});

import { createContext, useContext } from 'react';
import vi from './vi.json';
import en from './en.json';

export type Locale = 'vi' | 'en';
export type Messages = typeof vi;

export const LOCALES: Record<Locale, Messages> = { vi, en };

export const I18nContext = createContext<Messages>(vi);

export function useT(): Messages {
  return useContext(I18nContext);
}

/** Replace {{key}} placeholders in a string. */
export function interp(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''));
}

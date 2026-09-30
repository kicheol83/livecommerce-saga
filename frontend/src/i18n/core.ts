import { en } from "./messages/en";
import { ko } from "./messages/ko";
import { uz } from "./messages/uz";

export type Lang = "ko" | "en" | "uz";

export const LANGS: Lang[] = ["ko", "en", "uz"];
export const DEFAULT_LANG: Lang = "ko";

const DICTIONARIES: Record<Lang, Record<string, string>> = { ko, en, uz };

const LOCALES: Record<Lang, string> = {
  ko: "ko-KR",
  en: "en-US",
  uz: "uz-UZ"
};

let current: Lang = DEFAULT_LANG;

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as string[]).includes(value);
}

export function getLang(): Lang {
  return current;
}

export function setCurrentLang(lang: Lang): void {
  current = lang;
}

export function locale(): string {
  return LOCALES[current];
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[current][key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
  if (vars === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function translatedRecord<K extends string>(keys: Record<K, string>): Record<K, string> {
  const result = {} as Record<K, string>;
  (Object.keys(keys) as K[]).forEach((name) => {
    Object.defineProperty(result, name, { enumerable: true, get: () => t(keys[name]) });
  });
  return result;
}

export function translatedList(keys: string[]): string[] {
  const result: string[] = [];
  keys.forEach((key, index) => {
    Object.defineProperty(result, index, { enumerable: true, get: () => t(key) });
  });
  return result;
}

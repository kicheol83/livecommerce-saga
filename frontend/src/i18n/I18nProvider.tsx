"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANG, isLang, setCurrentLang, t, type Lang } from "./core";

const STORAGE_KEY = "livecommerce.lang";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: typeof t;
};

const I18nContext = createContext<I18nContextValue>({ lang: DEFAULT_LANG, setLang: () => undefined, t });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next);
    setLangState(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (isLang(saved) && saved !== DEFAULT_LANG) {
      setLang(saved);
    }
  }, [setLang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

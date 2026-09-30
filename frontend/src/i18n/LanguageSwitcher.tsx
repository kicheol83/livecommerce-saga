"use client";

import { LANGS, type Lang } from "./core";
import { useI18n } from "./I18nProvider";

const LABELS: Record<Lang, string> = { ko: "KO", en: "EN", uz: "UZ" };

type LanguageSwitcherProps = {
  variant?: "dark" | "light";
  compact?: boolean;
};

export function LanguageSwitcher({ variant = "dark", compact = false }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useI18n();

  if (compact) {
    return (
      <label className="relative shrink-0">
        <span className="sr-only">{t("common.language")}</span>
        <select
          value={lang}
          onChange={(event) => setLang(event.target.value as Lang)}
          className="h-8 appearance-none rounded-full bg-black/40 px-2.5 text-[12px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {LANGS.map((option) => (
            <option key={option} value={option} className="text-pine">
              {LABELS[option]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const base = variant === "dark" ? "border-white/25 text-frost/75" : "border-frost-300 text-ash";
  const active = variant === "dark" ? "bg-frost text-pine" : "bg-pine text-frost";

  return (
    <div role="group" aria-label={t("common.language")} className={`inline-flex shrink-0 overflow-hidden rounded-full border ${base}`}>
      {LANGS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={`px-2.5 py-1 text-[12px] font-bold transition-colors ${lang === option ? active : "hover:text-current"}`}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}

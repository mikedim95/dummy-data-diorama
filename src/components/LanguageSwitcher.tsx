import { useEffect } from "react";
import { Languages } from "lucide-react";
import { setLanguage, translate as t, useLanguage, type Language } from "@/lib/i18n";

const preferenceKey = "wam-language";
export function LanguageSwitcher() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(preferenceKey);
      if (saved === "el" || saved === "en") setLanguage(saved);
    } catch {
      /* Language switching remains available when browser storage is disabled. */
    }
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-end border-b border-border/60 bg-background/95 px-3 backdrop-blur-sm">
      <LanguageSelect />
    </div>
  );
}
export function LanguageSelect() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2 text-sm">
      <Languages aria-hidden="true" className="size-4 text-brass" />
      <span className="sr-only">{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => {
          const next = event.target.value as Language;
          setLanguage(next);
          try {
            localStorage.setItem(preferenceKey, next);
          } catch {
            /* The current session still keeps the selected language. */
          }
        }}
        className="h-full min-w-24 cursor-pointer bg-transparent pr-1 text-foreground focus-visible:outline-gold"
      >
        <option value="el" lang="el" className="bg-popover">
          Ελληνικά
        </option>
        <option value="en" lang="en" className="bg-popover">
          English
        </option>
      </select>
    </label>
  );
}

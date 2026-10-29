import { useSyncExternalStore } from "react";
import { greek } from "./el";
import { greekSingular } from "./singular";

export type Language = "el" | "en";
const listeners = new Set<() => void>();
let language: Language = "el";
export const getLanguage = () => language;
export const getLocale = () => (language === "el" ? "el-GR" : "en-GB");
export function setLanguage(next: Language) {
  if (next === language) return;
  language = next;
  for (const listener of listeners) listener();
}
export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getLanguage,
    () => "el" as const,
  );
}
export function translate(source: string, ...values: unknown[]): string {
  const template =
    language === "el"
      ? ((Number(values[0]) === 1 ? greekSingular[source] : undefined) ?? greek[source] ?? source)
      : source;
  if (language === "el" && template === source && !values.length) {
    const fieldError = /^([\w.[\]]+): (.+)$/.exec(source);
    if (source.includes("; "))
      return source
        .split("; ")
        .map((part) => translate(part))
        .join("; ");
    if (fieldError)
      return `${translate(fieldError[1]!.replace(/^values\./, "").replace(/_id$/, ""))}: ${translate(fieldError[2]!)}`;
    if (source.startsWith("Invalid option:") || source.startsWith("Invalid enum value"))
      return translate("Select a valid option.");
    if (source.startsWith("Invalid input:"))
      return translate(
        source.includes("undefined") ? "Complete this required field." : "Enter a valid value.",
      );
    if (source.startsWith("Too small:") || source.startsWith("Too big:"))
      return translate("Enter a value within the allowed limits.");
    if (source.startsWith("Unrecognized key"))
      return translate("This form contains an unsupported field.");
    const human = source
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (letter) => letter.toUpperCase());
    if (greek[human]) return greek[human];
    for (const pattern of patterns) {
      const match = pattern.expression.exec(source);
      if (match)
        return (
          (Number(match[1]) === 1 ? greekSingular[pattern.key] : undefined) ?? pattern.translation
        ).replace(/\{(\d+)\}/g, (_, index: string) => match[Number(index) + 1] ?? "");
    }
    if (source.includes(" · "))
      return source
        .split(" · ")
        .map((part) => translate(part))
        .join(" · ");
  }
  return template.replace(/\{(\d+)\}/g, (match, index: string) =>
    values[Number(index)] == null ? match : String(values[Number(index)]),
  );
}
const patterns = Object.entries(greek)
  .filter(([key]) => /\{\d+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length)
  .map(([key, translation]) => ({
    key,
    expression: new RegExp(
      "^" +
        key
          .split(/\{\d+\}/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("(.+?)") +
        "$",
    ),
    translation,
  }));
export function translateValue<T>(value: T): T | string {
  return typeof value === "string" ? translate(value) : value;
}

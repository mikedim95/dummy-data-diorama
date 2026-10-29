import { translate, useLanguage } from "@/lib/i18n";

export function LocalizedText({ text }: { text: string }) {
  useLanguage();
  return translate(text);
}

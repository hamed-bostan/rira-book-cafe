import type { routing } from "@/src/i18n/routing";

import type messages from "../../messages/en.json";

/**
 * Type-safe i18n: binds next-intl's `Locale` to the configured locales and `Messages`
 * to the English catalog (the base for keys). This gives `useTranslations` /
 * `getTranslations` autocompletion and compile-time errors for missing keys. (Module
 * augmentation must use `interface` for declaration merging.)
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

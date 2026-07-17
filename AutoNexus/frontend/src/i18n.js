import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";

// Manual toggle, not automatic browser-language detection -- the detector
// plugin is only used here for its localStorage persistence (so a chosen
// language survives a refresh), with the detection order restricted to
// localStorage alone and a hard-coded French fallback, per the product
// decision to default to French for this market regardless of browser/OS
// locale.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "fr",
    supportedLngs: ["en", "fr"],
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: "autonexus_language",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false, // React already escapes output
    },
  });

export default i18n;

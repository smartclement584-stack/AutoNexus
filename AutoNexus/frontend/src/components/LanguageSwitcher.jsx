import { useTranslation } from "react-i18next";

/**
 * Manual EN/FR toggle -- language is a deliberate user choice here, not
 * auto-detected from the browser, per product decision (default French for
 * this market, but trivially easy to switch). i18next-browser-languagedetector
 * persists the choice to localStorage under "autonexus_language" (see i18n.js).
 */
const LanguageSwitcher = ({ className = "" }) => {
  const { i18n } = useTranslation();

  const setLang = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div
      className={`flex items-center bg-gray-100 rounded-lg p-1 text-sm font-medium ${className}`}
      data-testid="language-switcher"
    >
      <button
        type="button"
        onClick={() => setLang("fr")}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          i18n.resolvedLanguage === "fr" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
        }`}
        data-testid="language-fr-btn"
        aria-pressed={i18n.resolvedLanguage === "fr"}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          i18n.resolvedLanguage === "en" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
        }`}
        data-testid="language-en-btn"
        aria-pressed={i18n.resolvedLanguage === "en"}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;

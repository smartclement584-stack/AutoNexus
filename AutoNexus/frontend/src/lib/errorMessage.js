import i18n from "@/i18n";

/**
 * Turns an axios error from the API into a localized, user-facing message.
 *
 * The backend attaches a stable `error_code` (e.g. "SELLER_NOT_FOUND")
 * alongside its existing English `detail` string on every AppException
 * response -- see backend/server.py's AppException. This looks up a
 * translation for that code under the `errors.*` namespace and uses it if
 * one exists.
 *
 * Falls back, in order:
 *   1. error_code -> translated message (if a translation exists for it)
 *   2. the raw English `detail` string from the API (covers any endpoint
 *      that doesn't send an error_code yet, or a code with no translation
 *      -- so nothing ever silently disappears, it's just untranslated)
 *   3. `fallbackKey` (a translation key you pass in, e.g. "errors.failed_to_save_part")
 *   4. a generic "something went wrong" message
 */
export function getErrorMessage(error, fallbackKey = "errors.generic_fallback") {
  const errorCode = error?.response?.data?.error_code;
  if (errorCode && i18n.exists(`errors.${errorCode}`)) {
    return i18n.t(`errors.${errorCode}`);
  }

  const detail = error?.response?.data?.detail;
  if (detail) {
    return detail;
  }

  return i18n.t(fallbackKey);
}

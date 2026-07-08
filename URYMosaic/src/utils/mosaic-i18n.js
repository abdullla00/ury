import en from "../locales/en.json";
import ar from "../locales/ar.json";
import fr from "../locales/fr.json";

const catalogs = { en, ar, fr };

function resolveLocale() {
  const stored = localStorage.getItem("mosaicLocale");
  if (stored && catalogs[stored]) return stored;
  const bootLang = window.frappe?.boot?.lang?.split("-")[0];
  if (bootLang && catalogs[bootLang]) return bootLang;
  const navLang = navigator.language?.split("-")[0];
  if (navLang && catalogs[navLang]) return navLang;
  return "en";
}

let activeLocale = resolveLocale();

export function setMosaicLocale(locale) {
  if (catalogs[locale]) {
    activeLocale = locale;
    localStorage.setItem("mosaicLocale", locale);
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }
}

export function getMosaicLocale() {
  return activeLocale;
}

export function t(key, params = {}) {
  const catalog = catalogs[activeLocale] || catalogs.en;
  let value = catalog[key] || catalogs.en[key] || key;
  Object.entries(params).forEach(([param, val]) => {
    value = value.replace(`{${param}}`, String(val));
  });
  return value;
}

setMosaicLocale(activeLocale);

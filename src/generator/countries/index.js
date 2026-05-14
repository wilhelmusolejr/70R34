import US from "./us/index.js";
import IT from "./it/index.js";

export const COUNTRIES = { US, IT };

export const COUNTRY_KEYS = Object.keys(COUNTRIES);

export const COUNTRY_OPTIONS = COUNTRY_KEYS.map((code) => ({
  code,
  label: COUNTRIES[code].label,
}));

export const DEFAULT_COUNTRY = "US";

export function getCountry(code) {
  return COUNTRIES[code] || COUNTRIES[DEFAULT_COUNTRY];
}

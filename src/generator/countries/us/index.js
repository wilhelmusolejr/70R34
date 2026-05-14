import { MALE_FIRST_NAMES, FEMALE_FIRST_NAMES, LAST_NAMES } from "./names.js";
import { CITIES, NEARBY_HOMETOWNS, REGION_NAME_BY_CODE } from "./locations.js";
import { HIGH_SCHOOLS_BY_REGION_CODE, COLLEGES_BY_MACRO_REGION, DEGREES } from "./education.js";
import { INDUSTRIES } from "./work.js";
import {
  NAME_PREFIXES as PAGE_NAME_PREFIXES,
  NAME_NOUNS as PAGE_NAME_NOUNS,
  BIO_TEMPLATES_BY_TONE,
} from "./pages.js";
import {
  BIO_TEMPLATES, QUOTE_TEMPLATES, QUOTES, MOTIVATIONAL_QUOTES,
  BIO_EMOJIS, TRAITS,
} from "./bios.js";
import { ARCHETYPES, ARCHETYPE_KEYS, ALIAS_NAMES, LANGUAGES } from "./interests.js";

export default {
  code: "US",
  label: "United States",
  names: {
    male: MALE_FIRST_NAMES,
    female: FEMALE_FIRST_NAMES,
    last: LAST_NAMES,
  },
  locations: {
    cities: CITIES,
    hometowns: NEARBY_HOMETOWNS,
    regionNameByCode: REGION_NAME_BY_CODE,
  },
  education: {
    highSchoolsByRegionCode: HIGH_SCHOOLS_BY_REGION_CODE,
    collegesByMacroRegion: COLLEGES_BY_MACRO_REGION,
    degrees: DEGREES,
  },
  industries: INDUSTRIES,
  bios: {
    templates: BIO_TEMPLATES,
    quoteTemplates: QUOTE_TEMPLATES,
    quotes: QUOTES,
    motivationalQuotes: MOTIVATIONAL_QUOTES,
    emojis: BIO_EMOJIS,
    traits: TRAITS,
  },
  interests: {
    archetypes: ARCHETYPES,
    archetypeKeys: ARCHETYPE_KEYS,
    aliasNames: ALIAS_NAMES,
    languages: LANGUAGES,
  },
  pages: {
    namePrefixes: PAGE_NAME_PREFIXES,
    nameNouns: PAGE_NAME_NOUNS,
    bioTemplatesByTone: BIO_TEMPLATES_BY_TONE,
  },
  meta: {
    defaultLanguage: "English",
    phonePrefix: "+1",
    emailDomains: [
      "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
      "aol.com", "protonmail.com", "live.com",
    ],
  },
};

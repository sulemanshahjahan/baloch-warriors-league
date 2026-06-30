// Tolerant country → flag resolver. Player nationality is free-text (country
// names, demonyms, ISO codes, or junk), so we normalise loosely and fall back
// gracefully to the raw text when there's no confident match.

// name / demonym / iso → ISO-3166 alpha-2
const TO_ISO2: Record<string, string> = {
  // South Asia
  pakistan: "PK", pakistani: "PK", pk: "PK",
  india: "IN", indian: "IN", in: "IN",
  bangladesh: "BD", bangladeshi: "BD", bd: "BD",
  "sri lanka": "LK", srilanka: "LK", srilankan: "LK", lk: "LK",
  nepal: "NP", nepali: "NP", np: "NP",
  afghanistan: "AF", afghan: "AF", af: "AF",
  bhutan: "BT", bt: "BT", maldives: "MV", mv: "MV",
  // Gulf / Middle East
  qatar: "QA", qatari: "QA", qa: "QA",
  uae: "AE", "united arab emirates": "AE", emirati: "AE", emirates: "AE", ae: "AE",
  "saudi arabia": "SA", saudi: "SA", ksa: "SA", sa: "SA",
  oman: "OM", omani: "OM", om: "OM",
  bahrain: "BH", bahraini: "BH", bh: "BH",
  kuwait: "KW", kuwaiti: "KW", kw: "KW",
  iran: "IR", iranian: "IR", ir: "IR",
  iraq: "IQ", iraqi: "IQ", iq: "IQ",
  turkey: "TR", turkish: "TR", "türkiye": "TR", tr: "TR",
  egypt: "EG", egyptian: "EG", eg: "EG",
  jordan: "JO", jordanian: "JO", jo: "JO",
  lebanon: "LB", lebanese: "LB", lb: "LB",
  syria: "SY", syrian: "SY", sy: "SY",
  yemen: "YE", yemeni: "YE", ye: "YE",
  palestine: "PS", palestinian: "PS", ps: "PS",
  // West / others common in the league
  "united kingdom": "GB", uk: "GB", british: "GB", england: "GB", gb: "GB",
  "united states": "US", usa: "US", american: "US", us: "US",
  canada: "CA", canadian: "CA", ca: "CA",
  australia: "AU", australian: "AU", au: "AU",
  germany: "DE", german: "DE", de: "DE",
  france: "FR", french: "FR", fr: "FR",
  spain: "ES", spanish: "ES", es: "ES",
  italy: "IT", italian: "IT", it: "IT",
  portugal: "PT", portuguese: "PT", pt: "PT",
  brazil: "BR", brazilian: "BR", br: "BR",
  argentina: "AR", argentine: "AR", argentinian: "AR", ar: "AR",
  netherlands: "NL", dutch: "NL", nl: "NL",
  nigeria: "NG", nigerian: "NG", ng: "NG",
  morocco: "MA", moroccan: "MA", ma: "MA",
  china: "CN", chinese: "CN", cn: "CN",
  japan: "JP", japanese: "JP", jp: "JP",
  malaysia: "MY", malaysian: "MY", my: "MY",
  indonesia: "ID", indonesian: "ID", id: "ID",
  philippines: "PH", filipino: "PH", ph: "PH",
};

// Canonical display name per ISO2 (for tooltips).
const ISO2_NAME: Record<string, string> = {
  PK: "Pakistan", IN: "India", BD: "Bangladesh", LK: "Sri Lanka", NP: "Nepal", AF: "Afghanistan",
  BT: "Bhutan", MV: "Maldives", QA: "Qatar", AE: "United Arab Emirates", SA: "Saudi Arabia",
  OM: "Oman", BH: "Bahrain", KW: "Kuwait", IR: "Iran", IQ: "Iraq", TR: "Türkiye", EG: "Egypt",
  JO: "Jordan", LB: "Lebanon", SY: "Syria", YE: "Yemen", PS: "Palestine", GB: "United Kingdom",
  US: "United States", CA: "Canada", AU: "Australia", DE: "Germany", FR: "France", ES: "Spain",
  IT: "Italy", PT: "Portugal", BR: "Brazil", AR: "Argentina", NL: "Netherlands", NG: "Nigeria",
  MA: "Morocco", CN: "China", JP: "Japan", MY: "Malaysia", ID: "Indonesia", PH: "Philippines",
};

function iso2ToFlag(iso2: string): string {
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export interface ResolvedCountry {
  iso2: string;
  flag: string; // emoji
  name: string; // canonical display name
}

/** Resolve free-text nationality → flag + canonical name, or null if unknown. */
export function resolveCountry(input: string | null | undefined): ResolvedCountry | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  if (!key) return null;
  let iso2 = TO_ISO2[key];
  // bare 2-letter ISO that we didn't list explicitly
  if (!iso2 && /^[a-z]{2}$/.test(key)) iso2 = key.toUpperCase();
  if (!iso2) return null;
  return { iso2, flag: iso2ToFlag(iso2), name: ISO2_NAME[iso2] ?? input.trim() };
}

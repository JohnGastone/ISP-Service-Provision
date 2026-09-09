/**
 * Tanzania-specific validation helpers.
 *
 * Mobile numbering (TCRA): national significant number is 9 digits beginning
 * with 6 or 7 (e.g. 0712 345 678 / 0655 123 456). Accepted input forms:
 *   0XXXXXXXXX        e.g. 0712345678
 *   255XXXXXXXXX      e.g. 255712345678
 *   +255XXXXXXXXX     e.g. +255712345678
 * Spaces and hyphens are tolerated on input and stripped before matching.
 */
export const TZ_PHONE_REGEX = /^(?:\+?255|0)[67]\d{8}$/;

/** Strips spaces, hyphens and parentheses so pasted numbers still validate. */
export function normalizePhoneInput(raw: string): string {
  return raw.replace(/[\s()-]/g, "");
}

export function isValidTzPhone(raw: string): boolean {
  return TZ_PHONE_REGEX.test(normalizePhoneInput(raw));
}

/** Canonical storage form: +255XXXXXXXXX. */
export function toE164(raw: string): string {
  const digits = normalizePhoneInput(raw).replace(/^\+/, "");
  const national = digits.startsWith("255") ? digits.slice(3) : digits.replace(/^0/, "");
  return `+255${national}`;
}

/** Display form: 0712 345 678 */
export function formatTzPhone(raw: string): string {
  const digits = normalizePhoneInput(raw).replace(/^\+/, "");
  const national = digits.startsWith("255") ? digits.slice(3) : digits.replace(/^0/, "");
  if (national.length !== 9) return raw;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/**
 * Regions and their districts. Trimmed to the districts most commonly used for
 * service addresses; extend freely — the forms read straight from this map.
 */
export const TZ_LOCATIONS: Record<string, string[]> = {
  Arusha: ["Arusha City", "Arusha Rural", "Karatu", "Longido", "Meru", "Monduli", "Ngorongoro"],
  "Dar es Salaam": ["Ilala", "Kigamboni", "Kinondoni", "Temeke", "Ubungo"],
  Dodoma: ["Bahi", "Chamwino", "Chemba", "Dodoma City", "Kondoa", "Kongwa", "Mpwapwa"],
  Geita: ["Bukombe", "Chato", "Geita", "Mbogwe", "Nyang'hwale"],
  Iringa: ["Iringa Municipal", "Iringa Rural", "Kilolo", "Mafinga", "Mufindi"],
  Kagera: ["Biharamulo", "Bukoba Municipal", "Bukoba Rural", "Karagwe", "Kyerwa", "Missenyi", "Muleba", "Ngara"],
  Katavi: ["Mlele", "Mpanda Municipal", "Mpimbwe", "Nsimbo", "Tanganyika"],
  Kigoma: ["Buhigwe", "Kakonko", "Kasulu", "Kibondo", "Kigoma Municipal", "Kigoma Rural", "Uvinza"],
  Kilimanjaro: ["Hai", "Moshi Municipal", "Moshi Rural", "Mwanga", "Rombo", "Same", "Siha"],
  Lindi: ["Kilwa", "Lindi Municipal", "Liwale", "Nachingwea", "Ruangwa"],
  Manyara: ["Babati Town", "Babati Rural", "Hanang", "Kiteto", "Mbulu", "Simanjiro"],
  Mara: ["Bunda", "Butiama", "Musoma Municipal", "Musoma Rural", "Rorya", "Serengeti", "Tarime"],
  Mbeya: ["Busokelo", "Chunya", "Kyela", "Mbarali", "Mbeya City", "Mbeya Rural", "Rungwe"],
  Morogoro: ["Gairo", "Ifakara", "Kilombero", "Kilosa", "Morogoro Municipal", "Morogoro Rural", "Mvomero", "Ulanga"],
  Mtwara: ["Masasi", "Mtwara Municipal", "Mtwara Rural", "Nanyamba", "Newala", "Tandahimba"],
  Mwanza: ["Buchosa", "Ilemela", "Kwimba", "Magu", "Misungwi", "Nyamagana", "Sengerema", "Ukerewe"],
  Njombe: ["Ludewa", "Makambako", "Makete", "Njombe Town", "Njombe Rural", "Wanging'ombe"],
  Pwani: ["Bagamoyo", "Chalinze", "Kibaha Town", "Kibaha Rural", "Kisarawe", "Mafia", "Mkuranga", "Rufiji"],
  Rukwa: ["Kalambo", "Nkasi", "Sumbawanga Municipal", "Sumbawanga Rural"],
  Ruvuma: ["Madaba", "Mbinga", "Namtumbo", "Nyasa", "Songea Municipal", "Songea Rural", "Tunduru"],
  Shinyanga: ["Kahama Town", "Kishapu", "Msalala", "Shinyanga Municipal", "Shinyanga Rural", "Ushetu"],
  Simiyu: ["Bariadi", "Busega", "Itilima", "Maswa", "Meatu"],
  Singida: ["Ikungi", "Iramba", "Itigi", "Manyoni", "Mkalama", "Singida Municipal", "Singida Rural"],
  Songwe: ["Ileje", "Mbozi", "Momba", "Songwe", "Tunduma"],
  Tabora: ["Igunga", "Kaliua", "Nzega", "Sikonge", "Tabora Municipal", "Urambo", "Uyui"],
  Tanga: ["Bumbuli", "Handeni", "Kilindi", "Korogwe", "Lushoto", "Muheza", "Mkinga", "Pangani", "Tanga City"],
  "Kaskazini Unguja": ["Kaskazini A", "Kaskazini B"],
  "Kusini Unguja": ["Kati", "Kusini"],
  "Mjini Magharibi": ["Magharibi A", "Magharibi B", "Mjini"],
  "Kaskazini Pemba": ["Micheweni", "Wete"],
  "Kusini Pemba": ["Chake Chake", "Mkoani"],
};

export const TZ_REGIONS = Object.keys(TZ_LOCATIONS).sort();

export function districtsFor(region: string): string[] {
  return TZ_LOCATIONS[region] ?? [];
}

export function isValidLocation(region: string, district: string): boolean {
  return districtsFor(region).includes(district);
}

/** Pakistani cities, provinces and common aliases / misspellings. */

export type Province = "Punjab" | "Sindh" | "KPK" | "Balochistan" | "ICT" | "AJK" | "GB";

// [name, province, ...aliases]
const RAW: Array<[string, Province, ...string[]]> = [
  ["Karachi", "Sindh", "khi", "karchi", "krachi", "karachee"],
  ["Lahore", "Punjab", "lhr", "lahor", "lahorr"],
  ["Islamabad", "ICT", "isb", "islamabd", "isloo", "islamabaad"],
  ["Rawalpindi", "Punjab", "pindi", "rwp", "rawalpindy", "rawlpindi"],
  ["Faisalabad", "Punjab", "lyallpur", "fsd", "faislabad", "faisalbad"],
  ["Multan", "Punjab", "multaan"],
  ["Peshawar", "KPK", "pekhawar", "pishawar", "peshwar"],
  ["Quetta", "Balochistan", "kwatah", "queta"],
  ["Hyderabad", "Sindh", "hyd", "haiderabad", "hydrabad"],
  ["Gujranwala", "Punjab", "gujranwalla", "gujrawala"],
  ["Sialkot", "Punjab", "siyalkot"],
  ["Bahawalpur", "Punjab", "bahawalpr", "bawalpur"],
  ["Sargodha", "Punjab", "sargoda"],
  ["Sukkur", "Sindh", "sakhar"],
  ["Larkana", "Sindh", "larkano"],
  ["Sheikhupura", "Punjab", "shaikhupura", "sheikhopura", "shekhupura"],
  ["Mardan", "KPK"],
  ["Gujrat", "Punjab", "gujrat city"],
  ["Kasur", "Punjab"],
  ["Rahim Yar Khan", "Punjab", "ryk", "rahimyarkhan"],
  ["Sahiwal", "Punjab", "montgomery"],
  ["Okara", "Punjab"],
  ["Wah Cantt", "Punjab", "wah", "wah cant"],
  ["Dera Ghazi Khan", "Punjab", "dg khan", "dgkhan", "d g khan"],
  ["Mirpur Khas", "Sindh", "mirpurkhas"],
  ["Nawabshah", "Sindh", "shaheed benazirabad", "nawab shah"],
  ["Mingora", "KPK", "swat", "saidu sharif"],
  ["Chiniot", "Punjab"],
  ["Kamoke", "Punjab"],
  ["Hafizabad", "Punjab"],
  ["Sadiqabad", "Punjab", "sadiq abad"],
  ["Burewala", "Punjab"],
  ["Kohat", "KPK"],
  ["Khanewal", "Punjab"],
  ["Dera Ismail Khan", "KPK", "di khan", "dikhan", "d i khan"],
  ["Turbat", "Balochistan"],
  ["Muzaffargarh", "Punjab", "muzafargarh"],
  ["Abbottabad", "KPK", "abbotabad", "abotabad"],
  ["Mandi Bahauddin", "Punjab", "mandi bahaudin"],
  ["Shikarpur", "Sindh"],
  ["Jacobabad", "Sindh"],
  ["Jhang", "Punjab"],
  ["Khanpur", "Punjab"],
  ["Gojra", "Punjab"],
  ["Bahawalnagar", "Punjab"],
  ["Muridke", "Punjab"],
  ["Pakpattan", "Punjab"],
  ["Tando Allahyar", "Sindh"],
  ["Tando Adam", "Sindh"],
  ["Tando Muhammad Khan", "Sindh"],
  ["Jaranwala", "Punjab"],
  ["Chishtian", "Punjab"],
  ["Daska", "Punjab"],
  ["Mianwali", "Punjab"],
  ["Ahmadpur East", "Punjab", "ahmed pur east"],
  ["Kamalia", "Punjab"],
  ["Khuzdar", "Balochistan"],
  ["Vihari", "Punjab"],
  ["Mansehra", "KPK"],
  ["Jhelum", "Punjab", "jehlum"],
  ["Attock", "Punjab"],
  ["Chakwal", "Punjab"],
  ["Haripur", "KPK"],
  ["Swabi", "KPK"],
  ["Nowshera", "KPK", "nowshehra"],
  ["Charsadda", "KPK"],
  ["Muzaffarabad", "AJK"],
  ["Mirpur", "AJK", "mirpur ajk", "mirpur azad kashmir"],
  ["Kotli", "AJK"],
  ["Bagh", "AJK"],
  ["Rawalakot", "AJK"],
  ["Gilgit", "GB"],
  ["Skardu", "GB"],
  ["Hunza", "GB", "karimabad"],
  ["Chitral", "KPK"],
  ["Gwadar", "Balochistan"],
  ["Hub", "Balochistan", "hub chowki"],
  ["Taxila", "Punjab"],
  ["Murree", "Punjab"],
  ["Sambrial", "Punjab"],
  ["Wazirabad", "Punjab"],
  ["Narowal", "Punjab"],
  ["Lodhran", "Punjab"],
  ["Layyah", "Punjab"],
  ["Rajanpur", "Punjab"],
  ["Toba Tek Singh", "Punjab", "tts"],
  ["Mianchannu", "Punjab", "mian channu"],
  ["Arifwala", "Punjab"],
  ["Hasilpur", "Punjab"],
  ["Bhakkar", "Punjab"],
  ["Khushab", "Punjab"],
  ["Jauharabad", "Punjab"],
  ["Pindi Bhattian", "Punjab"],
  ["Sangla Hill", "Punjab"],
  ["Shorkot", "Punjab"],
  ["Samundri", "Punjab"],
  ["Nankana Sahib", "Punjab", "nankana"],
  ["Kharian", "Punjab"],
  ["Lala Musa", "Punjab", "lalamusa"],
  ["Mandi Faizabad", "Punjab"],
  ["Rohri", "Sindh"],
  ["Ghotki", "Sindh"],
  ["Dadu", "Sindh"],
  ["Jamshoro", "Sindh"],
  ["Thatta", "Sindh"],
  ["Badin", "Sindh"],
  ["Sanghar", "Sindh"],
  ["Umerkot", "Sindh"],
  ["Mithi", "Sindh"],
  ["Kandhkot", "Sindh"],
  ["Kashmore", "Sindh"],
  ["Khairpur", "Sindh"],
  ["Matiari", "Sindh"],
  ["Hala", "Sindh"],
  ["Shahdadkot", "Sindh"],
  ["Bannu", "KPK"],
  ["Lakki Marwat", "KPK"],
  ["Tank", "KPK"],
  ["Karak", "KPK"],
  ["Hangu", "KPK"],
  ["Batkhela", "KPK"],
  ["Timergara", "KPK"],
  ["Dir", "KPK", "upper dir", "lower dir"],
  ["Buner", "KPK"],
  ["Shangla", "KPK"],
  ["Besham", "KPK"],
  ["Balakot", "KPK"],
  ["Havelian", "KPK"],
  ["Tarbela", "KPK"],
  ["Mohmand", "KPK"],
  ["Khyber", "KPK", "landi kotal"],
  ["Parachinar", "KPK"],
  ["Zhob", "Balochistan"],
  ["Sibi", "Balochistan"],
  ["Loralai", "Balochistan"],
  ["Chaman", "Balochistan"],
  ["Pishin", "Balochistan"],
  ["Kalat", "Balochistan"],
  ["Mastung", "Balochistan"],
  ["Nushki", "Balochistan"],
  ["Panjgur", "Balochistan"],
  ["Dera Murad Jamali", "Balochistan"],
  ["Usta Muhammad", "Balochistan"],
  ["Jaffarabad", "Balochistan"],
  ["Ghizer", "GB"],
  ["Diamer", "GB", "chilas"],
  ["Ghanche", "GB"],
  ["Astore", "GB"],
  ["Neelum", "AJK"],
  ["Sudhnoti", "AJK"],
  ["Bhimber", "AJK"],
  ["Haveli", "AJK"],
  ["Kallar Syedan", "Punjab"],
  ["Gujar Khan", "Punjab", "gujjar khan"],
  ["Sohawa", "Punjab"],
  ["Fateh Jang", "Punjab"],
  ["Hassan Abdal", "Punjab", "hasan abdal"],
  ["Rawat", "Punjab"],
  ["Chakri", "Punjab"],
  ["Bhalwal", "Punjab"],
  ["Sillanwali", "Punjab"],
  ["Pasrur", "Punjab"],
  ["Phalia", "Punjab"],
  ["Malakwal", "Punjab"],
  ["Ferozewala", "Punjab"],
  ["Raiwind", "Punjab"],
  ["Gwadar Port", "Balochistan"],
  ["Ormara", "Balochistan"],
  ["Lasbela", "Balochistan", "uthal"],
  ["Bela", "Balochistan"],
  ["Kech", "Balochistan"],
];

export interface CityMatch {
  city: string;
  province: Province | null;
  verified: boolean;
}

export interface CityInfo {
  name: string;
  province: Province;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

const INDEX = new Map<string, CityInfo>();
for (const [name, province, ...aliases] of RAW) {
  const info = { name, province };
  INDEX.set(norm(name), info);
  for (const a of aliases) INDEX.set(norm(a), info);
}
const KEYS = [...INDEX.keys()];

export const CITY_LIST: CityInfo[] = RAW.map(([name, province]) => ({ name, province }));

export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function titleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Match a free-text city to the canonical list. Case/space-insensitive, edit distance <= 2. */
export function matchCity(input: string): CityMatch {
  const key = norm(input);
  if (!key || key === "other") return { city: "Other", province: null, verified: false };
  const exact = INDEX.get(key);
  if (exact) return { city: exact.name, province: exact.province, verified: true };

  const maxDist = key.length >= 7 ? 2 : key.length >= 4 ? 1 : 0;
  if (maxDist > 0) {
    let best: { key: string; d: number } | null = null;
    for (const k of KEYS) {
      const d = levenshtein(key, k, maxDist);
      if (d <= maxDist && (!best || d < best.d)) best = { key: k, d };
    }
    if (best) {
      const info = INDEX.get(best.key)!;
      return { city: info.name, province: info.province, verified: true };
    }
  }
  return { city: titleCase(input).slice(0, 60), province: null, verified: false };
}

const JUNK_WORDS = new Set(["test", "testing", "abc", "abcd", "asdf", "qwerty", "xyz", "none", "na", "nil", "unknown", "city", "fake", "no"]);

/** Heuristic for obviously fake city input (only meaningful when the city is also unverified). */
export function isJunkCity(input: string): boolean {
  const raw = input.trim().toLowerCase();
  const key = norm(raw);
  if (key.length < 3) return true;
  if (/\d/.test(raw)) return true;
  if (JUNK_WORDS.has(key)) return true;
  if (/(.)\1{3,}/.test(key)) return true;
  if (!/[aeiouy]/.test(key)) return true;
  if (/asdf|sdfg|dfgh|qwer|wert|zxcv|xcvb|hjkl|qaz|wsx/.test(key)) return true;
  return false;
}

/** Province code for Shopify shippingAddress.provinceCode (ISO 3166-2:PK). */
export function provinceCode(p: Province | null): string | undefined {
  switch (p) {
    case "Punjab": return "PB";
    case "Sindh": return "SD";
    case "KPK": return "KP";
    case "Balochistan": return "BA";
    case "ICT": return "IS";
    case "AJK": return "JK";
    case "GB": return "GB";
    default: return undefined;
  }
}

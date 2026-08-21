/**
 * Matching a homeowner to a home.
 *
 * A warranty request arrives with whatever the homeowner happened to type: a
 * serial number off the data plate if they went looking for it, otherwise an
 * address, a name, and a phone number. The job here is to find the one home
 * they mean, or to say plainly that we cannot tell.
 *
 * The rule the whole module is built around: **never attach a request to a home
 * unless exactly one home is implicated and nothing else contradicts it.** An
 * ambiguous match is worse than no match — it puts a stranger's repair history
 * on someone else's record — so ambiguity resolves to "needs review", not to a
 * best guess.
 */
import { canonicalKey } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** USPS-style suffix abbreviations, plus the spellings people actually use. */
const STREET_SUFFIXES: Record<string, string> = {
  ALLEY: "ALY", ALY: "ALY",
  AVENUE: "AVE", AVENU: "AVE", AVEN: "AVE", AV: "AVE", AVE: "AVE",
  BOULEVARD: "BLVD", BOUL: "BLVD", BLVD: "BLVD", BLVED: "BLVD",
  BEND: "BND", BND: "BND",
  BRANCH: "BR", BR: "BR",
  BYPASS: "BYP", BYP: "BYP",
  CIRCLE: "CIR", CIRC: "CIR", CIRCL: "CIR", CRCL: "CIR", CIR: "CIR",
  COURT: "CT", CRT: "CT", CT: "CT",
  COVE: "CV", CV: "CV",
  CREEK: "CRK", CRK: "CRK",
  CROSSING: "XING", XING: "XING",
  DRIVE: "DR", DRIV: "DR", DRV: "DR", DR: "DR",
  ESTATE: "EST", ESTATES: "ESTS", EST: "EST", ESTS: "ESTS",
  EXPRESSWAY: "EXPY", EXPY: "EXPY",
  EXTENSION: "EXT", EXT: "EXT",
  FARM: "FRM", FRM: "FRM",
  FORK: "FRK", FRK: "FRK",
  GLEN: "GLN", GLN: "GLN",
  GREEN: "GRN", GRN: "GRN",
  GROVE: "GRV", GRV: "GRV",
  HEIGHTS: "HTS", HTS: "HTS",
  HIGHWAY: "HWY", HIGHWY: "HWY", HIWAY: "HWY", HWY: "HWY",
  HILL: "HL", HL: "HL", HILLS: "HLS", HLS: "HLS",
  HOLLOW: "HOLW", HOLW: "HOLW",
  ISLAND: "IS", IS: "IS",
  JUNCTION: "JCT", JCT: "JCT",
  KNOLL: "KNL", KNL: "KNL",
  LAKE: "LK", LK: "LK", LAKES: "LKS", LKS: "LKS",
  LANDING: "LNDG", LNDG: "LNDG",
  LANE: "LN", LN: "LN",
  LOOP: "LOOP",
  MEADOW: "MDW", MDW: "MDW", MEADOWS: "MDWS", MDWS: "MDWS",
  MILL: "ML", ML: "ML",
  MOUNTAIN: "MTN", MOUNTIN: "MTN", MTIN: "MTN", MTN: "MTN",
  PARK: "PARK", PK: "PARK",
  PARKWAY: "PKWY", PARKWY: "PKWY", PKWAY: "PKWY", PKY: "PKWY", PKWY: "PKWY",
  PASS: "PASS",
  PATH: "PATH",
  PIKE: "PIKE",
  PLACE: "PL", PL: "PL",
  PLAZA: "PLZ", PLZ: "PLZ",
  POINT: "PT", PT: "PT", POINTE: "PT",
  RANCH: "RNCH", RNCH: "RNCH",
  RIDGE: "RDG", RDGE: "RDG", RDG: "RDG",
  RIVER: "RIV", RIV: "RIV",
  ROAD: "RD", RD: "RD",
  ROUTE: "RTE", RTE: "RTE",
  RUN: "RUN",
  SHORE: "SHR", SHR: "SHR", SHORES: "SHRS", SHRS: "SHRS",
  SPRING: "SPG", SPG: "SPG", SPRINGS: "SPGS", SPGS: "SPGS",
  SQUARE: "SQ", SQ: "SQ",
  STATION: "STA", STA: "STA",
  STREET: "ST", STRT: "ST", STR: "ST", ST: "ST",
  SUMMIT: "SMT", SMT: "SMT",
  TERRACE: "TER", TERR: "TER", TER: "TER",
  TRACE: "TRCE", TRCE: "TRCE",
  TRAIL: "TRL", TRAILS: "TRL", TRL: "TRL",
  TURNPIKE: "TPKE", TPKE: "TPKE",
  VALLEY: "VLY", VLY: "VLY",
  VIEW: "VW", VW: "VW",
  VILLAGE: "VLG", VLG: "VLG",
  WALK: "WALK",
  WAY: "WAY", WY: "WAY",
  WOODS: "WDS", WDS: "WDS",
};

const DIRECTIONALS: Record<string, string> = {
  NORTH: "N", N: "N",
  SOUTH: "S", S: "S",
  EAST: "E", E: "E",
  WEST: "W", W: "W",
  NORTHEAST: "NE", NE: "NE",
  NORTHWEST: "NW", NW: "NW",
  SOUTHEAST: "SE", SE: "SE",
  SOUTHWEST: "SW", SW: "SW",
};

/** "FIRST STREET" and "1ST ST" are the same street. */
const ORDINAL_WORDS: Record<string, string> = {
  FIRST: "1ST", SECOND: "2ND", THIRD: "3RD", FOURTH: "4TH", FIFTH: "5TH",
  SIXTH: "6TH", SEVENTH: "7TH", EIGHTH: "8TH", NINTH: "9TH", TENTH: "10TH",
  ELEVENTH: "11TH", TWELFTH: "12TH",
};

const UNIT_DESIGNATORS = new Set(["APT", "APARTMENT", "UNIT", "STE", "SUITE", "LOT", "TRLR", "TRAILER", "BLDG", "BUILDING", "RM", "ROOM", "#"]);

export interface AddressInput {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export interface AddressKey {
  /** House number, directionals, street name, suffix, and unit — the part that identifies the parcel. */
  street: string;
  /** ZIP5 when we have one, otherwise the city. Empty when neither was given. */
  locality: string;
  /** `street|locality` — what gets stored and compared. */
  key: string;
}

function tokenize(value: string): string[] {
  return value
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/#\s*/g, "# ")
    .replace(/[^A-Z0-9#/\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Reduces a street address to a comparable form. Returns null when there is not
 * enough to be worth comparing — a bare city, or a house number with no street.
 */
export function normalizeAddress(input: AddressInput): AddressKey | null {
  const raw = (input.address ?? "").trim();
  const zip5 = (input.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  const cityToken = tokenize(input.city ?? "").join(" ");

  if (!raw) return null;

  // A homeowner typing one box often writes "12 Bend Rd, Vilas NC 28692" — or
  // "184 Mill Creek Road, Lot 12", where the comma separates the unit rather
  // than the town. A segment that opens with a unit designator belongs to the
  // street, not to the locality.
  const segments = raw.split(",").map((segment) => segment.trim()).filter(Boolean);
  const streetSegments = segments.slice(0, 1);
  const restSegments: string[] = [];
  for (const segment of segments.slice(1)) {
    const first = tokenize(segment)[0];
    if (first && (UNIT_DESIGNATORS.has(first) || first === "#") && restSegments.length === 0) {
      streetSegments.push(segment);
    } else {
      restSegments.push(segment);
    }
  }
  const inlineRest = restSegments.join(" ");

  const tokens = tokenize(streetSegments.join(" "));
  if (tokens.length === 0) return null;

  // Split the unit off first: "184 Mill Creek Rd Lot 12" is a street plus a unit.
  let unitAt = -1;
  for (let i = 1; i < tokens.length; i += 1) {
    if (UNIT_DESIGNATORS.has(tokens[i]) || tokens[i] === "#") {
      unitAt = i;
      break;
    }
  }
  const streetTokens = unitAt === -1 ? tokens : tokens.slice(0, unitAt);
  const unitTokens = unitAt === -1 ? [] : tokens.slice(unitAt + 1).filter((token) => token !== "#");
  if (streetTokens.length === 0) return null;

  const out: string[] = [];
  for (let i = 0; i < streetTokens.length; i += 1) {
    const token = ORDINAL_WORDS[streetTokens[i]] ?? streetTokens[i];
    const isLast = i === streetTokens.length - 1;

    // Only the trailing word is a street *suffix*. Abbreviating every token
    // would turn "Mill Creek Rd" into "ML CRK RD" and stop it matching
    // "Mill Creek Road".
    if (isLast && streetTokens.length > 1 && STREET_SUFFIXES[token]) {
      out.push(STREET_SUFFIXES[token]);
      continue;
    }
    // A directional only counts as one at the head or the tail of the name.
    const isEdge = i === 0 || i === 1 || isLast;
    if (isEdge && DIRECTIONALS[token] && streetTokens.length > 2) {
      out.push(DIRECTIONALS[token]);
      continue;
    }
    out.push(token);
  }

  if (unitTokens.length > 0) out.push("UNIT", ...unitTokens);

  const street = out.join(" ").trim();
  // Needs at least a number and a word — "SPRINGS" alone is not an address.
  if (street.split(" ").length < 2) return null;

  const inlineZip = /\b(\d{5})(?:-\d{4})?\b/.exec(inlineRest)?.[1] ?? "";
  const inlineCity = tokenize(inlineRest.replace(/\b\d{5}(?:-\d{4})?\b/g, "").replace(/\b[A-Z]{2}\b\s*$/i, ""))
    .filter((token) => !DIRECTIONALS[token] || token.length > 2)
    .join(" ");

  const locality = zip5 || inlineZip || cityToken || inlineCity || "";
  return { street, locality, key: `${street}|${locality}` };
}

/**
 * Recomputes every stored matching key from the text beside it.
 *
 * Useful after a bulk import, after this file's rules change, and to guarantee
 * that seeded data agrees with what the application would have written.
 */
export async function backfillMatchKeys(db: Db): Promise<{ homes: number; lots: number; subdivisions: number }> {
  const homes = await db
    .prepare(
      `SELECT id, site_address, site_city, site_state, site_postal_code, customer_name, customer_phone
         FROM homes WHERE site_address IS NOT NULL OR customer_name IS NOT NULL OR customer_phone IS NOT NULL`,
    )
    .all<{
      id: string;
      site_address: string | null;
      site_city: string | null;
      site_state: string | null;
      site_postal_code: string | null;
      customer_name: string | null;
      customer_phone: string | null;
    }>();

  for (const home of homes.results) {
    await db
      .prepare("UPDATE homes SET site_address_key = ?, customer_name_key = ?, customer_phone_key = ? WHERE id = ?")
      .bind(
        normalizeAddress({
          address: home.site_address,
          city: home.site_city,
          state: home.site_state,
          postalCode: home.site_postal_code,
        })?.key ?? null,
        normalizeName(home.customer_name),
        normalizePhone(home.customer_phone),
        home.id,
      )
      .run();
  }

  const counts = { homes: homes.results.length, lots: 0, subdivisions: 0 };

  for (const [table, key] of [["lots", "lots"], ["jobs", "subdivisions"]] as const) {
    const rows = await db
      .prepare(`SELECT id, street_address, city, state, postal_code FROM ${table} WHERE street_address IS NOT NULL`)
      .all<{ id: string; street_address: string | null; city: string | null; state: string | null; postal_code: string | null }>();
    for (const row of rows.results) {
      await db
        .prepare(`UPDATE ${table} SET address_key = ? WHERE id = ?`)
        .bind(
          normalizeAddress({
            address: row.street_address,
            city: row.city,
            state: row.state,
            postalCode: row.postal_code,
          })?.key ?? null,
          row.id,
        )
        .run();
    }
    counts[key] = rows.results.length;
  }

  return counts;
}

/** Ten digits, or nothing. A seven-digit fragment cannot identify a household. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

const NAME_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V", "MD", "PHD", "ESQ"]);
const NAME_PREFIXES = new Set(["MR", "MRS", "MS", "MISS", "DR"]);

/**
 * Sorted surname/given tokens, so "John Smith" and "Smith, John" agree.
 * Single letters (middle initials) and honorifics are dropped.
 */
export function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  const tokens = value
    .toUpperCase()
    .replace(/[^A-Z\s'-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/[''-]/g, ""))
    .filter((token) => token.length > 1 && !NAME_SUFFIXES.has(token) && !NAME_PREFIXES.has(token));
  if (tokens.length === 0) return null;
  return [...new Set(tokens)].sort().join(" ");
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type MatchMethod = "none" | "serial" | "address" | "phone" | "name_and_address" | "name_and_phone" | "manual";
export type MatchConfidence = "none" | "ambiguous" | "confident";

export interface MatchSignals {
  serialNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  customerName?: string | null;
  phone?: string | null;
}

export interface MatchCandidate {
  home_id: string;
  serial_number: string;
  site_address: string | null;
  customer_name: string | null;
  /** Which signals pointed at this home. */
  signals: string[];
}

export interface MatchResult {
  homeId: string | null;
  method: MatchMethod;
  confidence: MatchConfidence;
  reason: string;
  candidates: MatchCandidate[];
}

interface HomeRowLite {
  id: string;
  serial_number: string;
  site_address: string | null;
  customer_name: string | null;
}

const MAX_CANDIDATES = 12;

/**
 * Resolves the signals to at most one home.
 *
 * Serial, address, and phone are each strong enough to identify a home on their
 * own — but only when they name exactly one. A name never identifies a home by
 * itself; it is used to break a tie that another signal left open.
 */
export async function matchHome(db: Db, signals: MatchSignals): Promise<MatchResult> {
  const found = new Map<string, { home: HomeRowLite; signals: Set<string> }>();
  const record = (home: HomeRowLite, signal: string) => {
    const entry = found.get(home.id) ?? { home, signals: new Set<string>() };
    entry.signals.add(signal);
    found.set(home.id, entry);
  };

  const serial = signals.serialNumber ? canonicalKey(signals.serialNumber) : "";
  const addressKey = normalizeAddress(signals);
  const phoneKey = normalizePhone(signals.phone);
  const nameKey = normalizeName(signals.customerName);

  // --- serial -------------------------------------------------------------
  let serialHomes: HomeRowLite[] = [];
  let serialWasPartial = false;
  if (serial) {
    serialHomes = await selectHomes(db, "SELECT id, serial_number, site_address, customer_name FROM homes WHERE serial_number = ?", [serial]);
    if (serialHomes.length === 0 && serial.length >= 6) {
      // People read a HUD label or drop a prefix. A long fragment that hits
      // exactly one home is still trustworthy; anything shorter is not.
      serialHomes = await selectHomes(
        db,
        "SELECT id, serial_number, site_address, customer_name FROM homes WHERE serial_number LIKE ? LIMIT ?",
        [`%${serial}%`, MAX_CANDIDATES],
      );
      serialWasPartial = serialHomes.length > 0;
    }
    for (const home of serialHomes) record(home, "serial");
  }

  // --- address ------------------------------------------------------------
  let addressHomes: HomeRowLite[] = [];
  let addressScope: "home" | "lot" | "subdivision" | null = null;
  if (addressKey) {
    addressHomes = await matchByAddress(db, addressKey, "home");
    if (addressHomes.length > 0) addressScope = "home";
    if (addressHomes.length === 0) {
      addressHomes = await matchByAddress(db, addressKey, "lot");
      if (addressHomes.length > 0) addressScope = "lot";
    }
    if (addressHomes.length === 0) {
      // A subdivision address covers every home in it, so this almost always
      // ends up ambiguous — which is the point.
      addressHomes = await matchByAddress(db, addressKey, "subdivision");
      if (addressHomes.length > 0) addressScope = "subdivision";
    }
    for (const home of addressHomes) record(home, "address");
  }

  // --- phone --------------------------------------------------------------
  let phoneHomes: HomeRowLite[] = [];
  if (phoneKey) {
    phoneHomes = await selectHomes(
      db,
      `SELECT DISTINCT h.id, h.serial_number, h.site_address, h.customer_name
         FROM homes h
        WHERE h.customer_phone_key = ?1
           OR h.id IN (SELECT w.home_id FROM warranty_requests w
                        WHERE w.customer_phone_key = ?1 AND w.home_id IS NOT NULL
                          AND w.match_confidence = 'confident')
        LIMIT ?2`,
      [phoneKey, MAX_CANDIDATES],
    );
    for (const home of phoneHomes) record(home, "phone");
  }

  // --- name ---------------------------------------------------------------
  let nameHomes: HomeRowLite[] = [];
  if (nameKey) {
    nameHomes = await selectHomes(
      db,
      `SELECT DISTINCT h.id, h.serial_number, h.site_address, h.customer_name
         FROM homes h
        WHERE h.customer_name_key = ?1
           OR h.id IN (SELECT w.home_id FROM warranty_requests w
                        WHERE w.customer_name_key = ?1 AND w.home_id IS NOT NULL
                          AND w.match_confidence = 'confident')
        LIMIT ?2`,
      [nameKey, MAX_CANDIDATES],
    );
    for (const home of nameHomes) record(home, "name");
  }

  const candidates: MatchCandidate[] = [...found.values()]
    .map((entry) => ({
      home_id: entry.home.id,
      serial_number: entry.home.serial_number,
      site_address: entry.home.site_address,
      customer_name: entry.home.customer_name,
      signals: [...entry.signals].sort(),
    }))
    .sort((a, b) => b.signals.length - a.signals.length || a.serial_number.localeCompare(b.serial_number))
    .slice(0, MAX_CANDIDATES);

  const unique = (rows: HomeRowLite[]) => (rows.length === 1 ? rows[0].id : null);
  const strong: { method: MatchMethod; homeId: string; note: string }[] = [];
  const serialUnique = unique(serialHomes);
  const addressUnique = unique(addressHomes);
  const phoneUnique = unique(phoneHomes);

  if (serialUnique) {
    strong.push({ method: "serial", homeId: serialUnique, note: serialWasPartial ? "serial number fragment matched one home" : "serial number matched exactly" });
  }
  if (addressUnique && addressScope !== "subdivision") {
    strong.push({ method: "address", homeId: addressUnique, note: `address matched one ${addressScope === "lot" ? "lot" : "home"}` });
  }
  if (phoneUnique) {
    strong.push({ method: "phone", homeId: phoneUnique, note: "phone number matched one home" });
  }

  // Two strong signals pointing at different homes is exactly the situation
  // where guessing does damage.
  const distinctStrong = new Set(strong.map((item) => item.homeId));
  if (distinctStrong.size > 1) {
    return {
      homeId: null,
      method: "none",
      confidence: "ambiguous",
      reason: `Signals disagree: ${strong.map((item) => item.note).join("; ")}. Needs a person.`,
      candidates,
    };
  }

  if (distinctStrong.size === 1) {
    const homeId = [...distinctStrong][0];
    const contradicted = [
      { rows: serialHomes, label: "serial number" },
      { rows: addressHomes, label: "address" },
      { rows: phoneHomes, label: "phone number" },
    ].find((signal) => signal.rows.length > 0 && !signal.rows.some((row) => row.id === homeId));

    if (contradicted) {
      return {
        homeId: null,
        method: "none",
        confidence: "ambiguous",
        reason: `The ${contradicted.label} points somewhere else. Needs a person.`,
        candidates,
      };
    }
    return {
      homeId,
      method: strong[0].method,
      confidence: "confident",
      reason: strong.map((item) => item.note).join("; "),
      candidates,
    };
  }

  // No single strong signal resolved. A name can still break a tie that an
  // address or a phone number left open.
  if (nameHomes.length > 0) {
    const narrow = (rows: HomeRowLite[], method: MatchMethod, note: string): MatchResult | null => {
      const overlap = rows.filter((row) => nameHomes.some((named) => named.id === row.id));
      if (overlap.length !== 1) return null;
      return { homeId: overlap[0].id, method, confidence: "confident", reason: note, candidates };
    };
    const byAddress = addressHomes.length > 1 ? narrow(addressHomes, "name_and_address", "name picked one home out of several at that address") : null;
    if (byAddress) return byAddress;
    const byPhone = phoneHomes.length > 1 ? narrow(phoneHomes, "name_and_phone", "name picked one home out of several on that phone number") : null;
    if (byPhone) return byPhone;
  }

  const ambiguous = serialHomes.length > 1 || addressHomes.length > 1 || phoneHomes.length > 1 || nameHomes.length > 0;
  if (ambiguous) {
    const detail: string[] = [];
    if (serialHomes.length > 1) detail.push(`${serialHomes.length} homes share that serial fragment`);
    if (addressHomes.length > 1) {
      detail.push(addressScope === "subdivision"
        ? `${addressHomes.length} homes are in that subdivision`
        : `${addressHomes.length} homes match that address`);
    }
    if (addressHomes.length === 1 && addressScope === "subdivision") detail.push("only the subdivision address matched, not a specific home");
    if (phoneHomes.length > 1) detail.push(`${phoneHomes.length} homes share that phone number`);
    if (detail.length === 0 && nameHomes.length > 0) {
      detail.push(nameHomes.length === 1 ? "only the customer name matched, which is not enough on its own" : `${nameHomes.length} homes match that name`);
    }
    return { homeId: null, method: "none", confidence: "ambiguous", reason: `${detail.join("; ")}. Needs a person.`, candidates };
  }

  return {
    homeId: null,
    method: "none",
    confidence: "none",
    reason: describeMissing(serial, addressKey, phoneKey, nameKey),
    candidates,
  };
}

function describeMissing(serial: string, addressKey: AddressKey | null, phoneKey: string | null, nameKey: string | null): string {
  const tried: string[] = [];
  if (serial) tried.push("serial number");
  if (addressKey) tried.push("address");
  if (phoneKey) tried.push("phone number");
  if (nameKey) tried.push("name");
  if (tried.length === 0) return "Nothing usable to match on. Needs a person.";
  return `No home matched the ${tried.join(", ")} given. Needs a person.`;
}

async function matchByAddress(db: Db, key: AddressKey, scope: "home" | "lot" | "subdivision"): Promise<HomeRowLite[]> {
  const column = scope === "home" ? "h.site_address_key" : scope === "lot" ? "l.address_key" : "j.address_key";
  // Exact key first (street and locality agree); fall back to street-only when
  // the homeowner left the city or ZIP off.
  const sql = `
    SELECT DISTINCT h.id, h.serial_number, h.site_address, h.customer_name
      FROM homes h
      LEFT JOIN lots l ON l.id = h.lot_id
      LEFT JOIN jobs j ON j.id = h.job_id
     WHERE ${column} = ?1 OR (?2 = 1 AND ${column} LIKE ?3)
     LIMIT ?4`;
  const streetOnly = key.locality === "" ? 1 : 0;
  return selectHomes(db, sql, [key.key, streetOnly, `${key.street}|%`, MAX_CANDIDATES]);
}

async function selectHomes(db: Db, sql: string, params: unknown[]): Promise<HomeRowLite[]> {
  const rows = await db.prepare(sql).bind(...params).all<HomeRowLite>();
  return rows.results;
}

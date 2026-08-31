import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { matchHome, normalizeAddress, normalizeName, normalizePhone } from "../src/domain/matching.ts";
import { updateSiteAddress } from "../src/domain/homes.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("address normalization", () => {
  const key = (address: string, extra: Record<string, string> = {}) => normalizeAddress({ address, ...extra })?.key;

  it("agrees across the ways people write a street suffix", () => {
    assert.equal(key("12 Bend Road"), key("12 BEND RD"));
    assert.equal(key("77 Ridgeview Lane"), key("77 ridgeview ln."));
    assert.equal(key("1200 Main Street"), key("1200 main st"));
  });

  it("abbreviates only the trailing suffix, not words inside the street name", () => {
    // "Mill" and "Creek" are suffix words too — abbreviating them would stop
    // "Mill Creek Road" matching "Mill Creek Rd".
    assert.equal(normalizeAddress({ address: "184 Mill Creek Rd" })?.street, "184 MILL CREEK RD");
    assert.equal(key("184 Mill Creek Road"), key("184 Mill Creek Rd"));
  });

  it("treats a unit as part of the street, however it is written", () => {
    const expected = "184 MILL CREEK RD UNIT 12";
    for (const written of ["184 Mill Creek Rd Lot 12", "184 Mill Creek Road, Lot 12", "184 Mill Creek Rd #12", "184 Mill Creek Rd Unit 12"]) {
      assert.equal(normalizeAddress({ address: written })?.street, expected, written);
    }
    assert.notEqual(key("184 Mill Creek Rd Lot 12"), key("184 Mill Creek Rd Lot 13"));
  });

  it("pulls the city and ZIP out of a single typed line", () => {
    assert.equal(key("12 Bend Rd, Vilas NC 28692"), "12 BEND RD|28692");
    assert.equal(key("77 Ridgeview Ln, Lenoir, NC 28645"), "77 RIDGEVIEW LN|28645");
    assert.equal(key("12 Bend Rd", { postalCode: "28692-1234" }), "12 BEND RD|28692");
  });

  it("normalizes directionals and spelled-out ordinals", () => {
    assert.equal(normalizeAddress({ address: "1200 North First Street" })?.street, "1200 N 1ST ST");
    assert.equal(key("1200 North First Street"), key("1200 N 1st St"));
  });

  it("refuses input that is not an address", () => {
    assert.equal(normalizeAddress({ address: "" }), null);
    assert.equal(normalizeAddress({ address: "Boone" }), null);
    assert.equal(normalizeAddress({ address: "   " }), null);
    assert.equal(normalizeAddress({ city: "Boone", postalCode: "28607" }), null);
  });
});

describe("phone and name normalization", () => {
  it("reduces a US number to ten digits", () => {
    for (const written of ["(828) 555-0198", "828-555-0198", "828.555.0198", "+1 828 555 0198", "18285550198"]) {
      assert.equal(normalizePhone(written), "8285550198", written);
    }
  });

  it("refuses anything that is not ten digits", () => {
    assert.equal(normalizePhone("555-0198"), null, "a seven-digit fragment cannot identify a household");
    assert.equal(normalizePhone("+44 20 7946 0958"), null);
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone(null), null);
  });

  it("matches a name whichever way round it is written", () => {
    assert.equal(normalizeName("Ray Pruitt"), normalizeName("Pruitt, Ray"));
    assert.equal(normalizeName("Mr. Ray Pruitt Jr."), normalizeName("ray pruitt"));
    assert.equal(normalizeName("Ray A. Pruitt"), normalizeName("Ray Pruitt"), "a middle initial is dropped");
    assert.equal(normalizeName("O'Brien, Kate"), "KATE OBRIEN");
    assert.equal(normalizeName(""), null);
  });
});

describe("matching a homeowner to a home", () => {
  let harness: Harness;
  before(async () => {
    harness = await createHarness();
  });
  after(() => harness.close());

  it("matches an exact serial number", async () => {
    const result = await matchHome(harness.db, { serialNumber: "cav-2026-nc 114772a" });
    assert.equal(result.confidence, "confident");
    assert.equal(result.method, "serial");
    const home = await harness.db.prepare("SELECT serial_number FROM homes WHERE id = ?").bind(result.homeId).first<{ serial_number: string }>();
    assert.equal(home?.serial_number, "CAV2026NC114772A");
  });

  it("matches a long serial fragment that hits exactly one home", async () => {
    const result = await matchHome(harness.db, { serialNumber: "NC114772A" });
    assert.equal(result.confidence, "confident");
    assert.match(result.reason, /fragment/);
  });

  it("will not match a short serial fragment", async () => {
    const result = await matchHome(harness.db, { serialNumber: "772A" });
    assert.equal(result.homeId, null);
    assert.equal(result.confidence, "none");
  });

  it("matches on address when there is no serial", async () => {
    const result = await matchHome(harness.db, { address: "12 Bend Road", city: "Vilas", state: "NC", postalCode: "28692" });
    assert.equal(result.confidence, "confident");
    assert.equal(result.method, "address");
  });

  it("matches on address with no city or ZIP at all", async () => {
    const result = await matchHome(harness.db, { address: "77 Ridgeview Ln" });
    assert.equal(result.confidence, "confident");
  });

  it("matches on phone number alone", async () => {
    const result = await matchHome(harness.db, { phone: "(828) 555-0142" });
    assert.equal(result.confidence, "confident");
    assert.equal(result.method, "phone");
  });

  it("refuses to guess when a name is all it has", async () => {
    const result = await matchHome(harness.db, { customerName: "Dana Whitfield" });
    assert.equal(result.homeId, null);
    assert.equal(result.confidence, "ambiguous");
    assert.match(result.reason, /not enough on its own/);
    assert.equal(result.candidates.length, 1, "the candidate is still recorded for the reviewer");
  });

  it("refuses to guess when only the subdivision address matches", async () => {
    const result = await matchHome(harness.db, { address: "184 Mill Creek Rd", city: "Boone", postalCode: "28607" });
    assert.equal(result.homeId, null);
    assert.equal(result.confidence, "ambiguous");
    assert.match(result.reason, /subdivision/);
    assert.ok(result.candidates.length >= 2);
  });

  it("lets a name break a tie the address left open", async () => {
    // Two homes at the same street number; only one has an owner on record.
    const result = await matchHome(harness.db, {
      address: "184 Mill Creek Rd",
      city: "Boone",
      postalCode: "28607",
      customerName: "Dana Whitfield",
    });
    assert.equal(result.confidence, "confident");
    assert.equal(result.method, "name_and_address");
  });

  it("refuses when two strong signals disagree", async () => {
    const result = await matchHome(harness.db, {
      serialNumber: "CAV2026NC114772A",
      address: "12 Bend Rd",
      postalCode: "28692",
    });
    assert.equal(result.homeId, null);
    assert.equal(result.confidence, "ambiguous");
    assert.match(result.reason, /points somewhere else|disagree/);
  });

  it("reports plainly when nothing matches", async () => {
    const result = await matchHome(harness.db, { address: "999 Nowhere Rd", city: "Elsewhere", postalCode: "99999" });
    assert.equal(result.homeId, null);
    assert.equal(result.confidence, "none");
    assert.equal(result.candidates.length, 0);
  });

  it("goes ambiguous when two homes share a phone number", async () => {
    await updateSiteAddress(harness.db, "hom_a2", { customerPhone: "(828) 555-0142", customerName: "Dana Whitfield" });
    const result = await matchHome(harness.db, { phone: "828 555 0142" });
    assert.equal(result.homeId, null);
    assert.equal(result.confidence, "ambiguous");
    assert.match(result.reason, /share that phone number/);
  });
});

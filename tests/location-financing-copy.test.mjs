import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/lib/locations.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const locationData = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const expectedLocations = [
  {
    "slug": "myrtle-beach",
    "name": "Myrtle Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29577",
    "headline": "New manufactured homes on land in Myrtle Beach, SC",
    "geo": {
      "lat": 33.6891,
      "lng": -78.8867
    }
  },
  {
    "slug": "conway",
    "name": "Conway",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29526",
    "headline": "New manufactured homes on land in Conway, SC",
    "geo": {
      "lat": 33.836,
      "lng": -79.0478
    }
  },
  {
    "slug": "loris",
    "name": "Loris",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29569",
    "headline": "New manufactured homes on land in Loris, SC",
    "geo": {
      "lat": 34.0563,
      "lng": -78.8903
    }
  },
  {
    "slug": "longs",
    "name": "Longs",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29568",
    "headline": "New manufactured homes on land in Longs, SC",
    "geo": {
      "lat": 33.9174,
      "lng": -78.7336
    }
  },
  {
    "slug": "aynor",
    "name": "Aynor",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29511",
    "headline": "New manufactured homes on land in Aynor, SC",
    "geo": {
      "lat": 33.9985,
      "lng": -79.1989
    }
  },
  {
    "slug": "north-myrtle-beach",
    "name": "North Myrtle Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in North Myrtle Beach, SC",
    "geo": {
      "lat": 33.816,
      "lng": -78.68
    }
  },
  {
    "slug": "surfside-beach",
    "name": "Surfside Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New Manufactured Homes on Land in Surfside Beach, SC",
    "geo": {
      "lat": 33.606,
      "lng": -78.974
    }
  },
  {
    "slug": "socastee",
    "name": "Socastee",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Socastee, SC",
    "geo": {
      "lat": 33.685,
      "lng": -78.987
    }
  },
  {
    "slug": "carolina-forest",
    "name": "Carolina Forest",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Carolina Forest, SC",
    "geo": {
      "lat": 33.78,
      "lng": -78.93
    }
  },
  {
    "slug": "little-river",
    "name": "Little River",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Little River, SC",
    "geo": {
      "lat": 33.873,
      "lng": -78.616
    }
  },
  {
    "slug": "garden-city-beach",
    "name": "Garden City Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Garden City Beach, SC",
    "geo": {
      "lat": 33.583,
      "lng": -79
    }
  },
  {
    "slug": "georgetown",
    "name": "Georgetown",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Georgetown, SC",
    "geo": {
      "lat": 33.376,
      "lng": -79.294
    }
  },
  {
    "slug": "pawleys-island",
    "name": "Pawleys Island",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land near Pawleys Island, SC",
    "geo": {
      "lat": 33.434,
      "lng": -79.122
    }
  },
  {
    "slug": "murrells-inlet",
    "name": "Murrells Inlet",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Murrells Inlet, SC",
    "geo": {
      "lat": 33.551,
      "lng": -79.034
    }
  },
  {
    "slug": "andrews",
    "name": "Andrews",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Andrews, SC",
    "geo": {
      "lat": 33.451,
      "lng": -79.563
    }
  },
  {
    "slug": "litchfield-beach",
    "name": "Litchfield Beach",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Litchfield Beach, SC",
    "geo": {
      "lat": 33.471,
      "lng": -79.108
    }
  },
  {
    "slug": "leland",
    "name": "Leland",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Leland, NC",
    "geo": {
      "lat": 34.256,
      "lng": -78.045
    }
  },
  {
    "slug": "shallotte",
    "name": "Shallotte",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Shallotte, NC",
    "geo": {
      "lat": 33.973,
      "lng": -78.382
    }
  },
  {
    "slug": "southport",
    "name": "Southport",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Southport, NC",
    "geo": {
      "lat": 33.921,
      "lng": -78.02
    }
  },
  {
    "slug": "oak-island",
    "name": "Oak Island",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Oak Island, NC",
    "geo": {
      "lat": 33.908,
      "lng": -78.137
    }
  },
  {
    "slug": "calabash",
    "name": "Calabash",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Calabash, NC",
    "geo": {
      "lat": 33.89,
      "lng": -78.566
    }
  },
  {
    "slug": "sunset-beach",
    "name": "Sunset Beach",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Sunset Beach, NC",
    "geo": {
      "lat": 33.88,
      "lng": -78.512
    }
  },
  {
    "slug": "ocean-isle-beach",
    "name": "Ocean Isle Beach",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Ocean Isle Beach, NC",
    "geo": {
      "lat": 33.895,
      "lng": -78.428
    }
  },
  {
    "slug": "whiteville",
    "name": "Whiteville",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New manufactured homes on land in Whiteville, NC",
    "geo": {
      "lat": 34.34,
      "lng": -78.706
    }
  },
  {
    "slug": "tabor-city",
    "name": "Tabor City",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New manufactured homes on land in Tabor City, NC",
    "geo": {
      "lat": 34.149,
      "lng": -78.873
    }
  },
  {
    "slug": "lake-waccamaw",
    "name": "Lake Waccamaw",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New manufactured homes on land in Lake Waccamaw, NC",
    "geo": {
      "lat": 34.316,
      "lng": -78.5
    }
  },
  {
    "slug": "chadbourn",
    "name": "Chadbourn",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New Manufactured Homes on Land in Chadbourn, NC",
    "geo": {
      "lat": 34.323,
      "lng": -78.826
    }
  }
];
const expectedUtilities = {
  "horry-sc": "Power comes from Horry Electric Cooperative, Santee Cooper, or Duke Energy; water and sewer from Grand Strand Water & Sewer Authority or a city system, with a private well and septic on rural lots.",
  "georgetown-sc": "Power comes from Santee Electric Cooperative, Santee Cooper, or the City of Georgetown; water and sewer from the Georgetown County Water & Sewer District or a city system, with a private well and septic on rural lots.",
  "brunswick-nc": "Power comes from Brunswick Electric (BEMC) or Duke Energy; water and sewer from Brunswick County Public Utilities, H2GO in the Leland area, or a town system, with a private well and septic on rural lots.",
  "columbus-nc": "Power comes from Brunswick EMC, Four County EMC, or Duke Energy; water and sewer from Columbus County Public Utilities or the City of Whiteville, with a private well and septic on rural lots."
};

test("all existing town URLs, names, county keys, headlines and coordinates remain intact", () => {
  assert.equal(locationData.locations.length, 27);
  assert.equal(new Set(locationData.locations.map((location) => location.slug)).size, 27);
  for (const expected of expectedLocations) {
    const location = locationData.getLocation(expected.slug);
    assert.ok(location, expected.slug);
    for (const key of ["slug", "name", "county", "countyKey", "headline"]) {
      assert.equal(location[key], expected[key], `${expected.slug}: ${key}`);
    }
    assert.equal(location.zip, expected.zip, expected.slug);
    assert.deepEqual(locationData.cityGeo[expected.slug], expected.geo, expected.slug);
    assert.equal(locationData.stateAbbrForSlug(expected.slug), expected.countyKey.endsWith("-nc") ? "NC" : "SC");
    assert.ok(location.paragraphs.length >= 2);
    assert.ok(location.highlights.length >= 3);
  }
  assert.equal(locationData.getLocation("not-a-town"), undefined);
});

test("county context preserves providers and uses the verified Zone II designation without speed or loan guarantees", () => {
  for (const [key, county] of Object.entries(locationData.counties)) {
    assert.equal(county.utilitiesText, expectedUtilities[key], key);
    assert.match(county.windText, /Wind Zone II\./, key);
    assert.doesNotMatch(county.windText, /Wind Zone I\.|100.?mph|can keep.*cost|guaranteed lower.*cost/i, key);
    assert.match(county.usdaText, /address|application|lender/i, key);
    assert.doesNotMatch(county.usdaText, /entire county|most of.*qualifies|largely.*eligible/i, key);
  }
});

test("local copy uses explicit parcel and scope guidance rather than town-wide offers", () => {
  for (const location of locationData.locations) {
    const copy = [location.intro, ...location.paragraphs, ...location.highlights].join(" ");
    assert.doesNotMatch(copy, /100.?mph|Exposure-D|no HOA on|one package, one price, one closing|low \$200s|179,999|qualifies for USDA|USDA \$0-down eligible/i, location.slug);
    assert.match(copy, /lot|parcel|property|land/i, location.slug);
    assert.match(copy, /ask|check|confirm|review|discuss|request/i, location.slug);
  }
  assert.doesNotMatch(source, /normalizeCurrentPackagePrice|replaceAll/);
  const page = readFileSync("src/app/locations/[slug]/page.tsx", "utf8");
  assert.match(page, /locations\.map\(\(l\) => \(\{ slug: l.slug \}\)\)/);
  assert.match(page, /robots: \{ index: Boolean\(locationEvidence\(loc.slug\)\), follow: true \}/);
  assert.match(page, /Prefer a[\s\S]*lot without an HOA/);
  assert.doesNotMatch(page, /one package, one closing, no HOA|Usually a few months/);
});

test("financing and comparison keep information requests separate from loan or safety assurances", () => {
  const financing = readFileSync("src/app/financing/page.tsx", "utf8");
  const comparison = readFileSync("src/app/mobile-home-vs-manufactured-home/page.tsx", "utf8");
  assert.match(financing, /not a loan application or approval/);
  assert.match(financing, /submitLabel="Request financing information"/);
  assert.match(financing, /official USDA eligibility tool/);
  assert.doesNotMatch(financing, /Every manufactured home we sell|A lot of Horry County qualifies|help for every credit situation|Apply for financing/);
  // The existing user-approved incentive is a separate business fact.
  assert.match(financing, /\$5,000 toward closing costs or a 6\.5% promotional rate/);
  assert.match(financing, /January 27, 2027/);
  assert.match(comparison, /Modular homes[\s\S]*state and local building codes/);
  assert.match(comparison, /No home is storm-proof/);
  assert.doesNotMatch(comparison, /Every factory-built home since|and it becomes|qualifies for a normal 30-year|Are these homes safe in Grand Strand hurricanes/);
});

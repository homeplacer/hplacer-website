// Local copy for the city landing pages. Keep it specific and honest — these
// pages exist to rank for "manufactured homes in <city> SC" and to show buyers
// we actually place homes there.

export interface LocationInfo {
  slug: string;
  name: string;
  county: string;
  countyKey: string; // links to `counties` for accurate per-county facts
  zip?: string;
  headline: string;
  intro: string;
  paragraphs: string[];
  highlights: string[];
}

// County context for the "Building a home in {town}" block. A county name
// does not establish parcel suitability, program eligibility, or approval.
export interface CountyInfo {
  key: string;
  name: string;
  stateAbbr: "SC" | "NC";
  windText: string;
  utilitiesText: string;
  permittingText: string;
  usdaText: string;
}

export const counties: Record<string, CountyInfo> = {
  "horry-sc": {
    key: "horry-sc",
    name: "Horry County",
    stateAbbr: "SC",
    windText:
      "Horry County is in HUD Wind Zone II. Confirm the home's data-plate ratings and the foundation and installation requirements for the actual site, including any coastal exposure requirements. A wind-zone designation is not a storm-safety guarantee.",
    utilitiesText:
      "Power comes from Horry Electric Cooperative, Santee Cooper, or Duke Energy; water and sewer from Grand Strand Water & Sewer Authority or a city system, with a private well and septic on rural lots.",
    permittingText:
      "Start with Horry County or the responsible city office for the parcel's placement and setup requirements. Confirm which permits, documents, and responsibilities apply to the agreed project scope.",
    usdaText:
      "USDA eligibility must be checked for the specific address and application. A participating lender reviews the home, household income, and other program requirements; a rural Horry County location alone is not approval",
  },
  "georgetown-sc": {
    key: "georgetown-sc",
    name: "Georgetown County",
    stateAbbr: "SC",
    windText:
      "Georgetown County is in HUD Wind Zone II. Check the selected home's data plate and the site's foundation and installation requirements. Coastal exposure can need additional review; no home is storm-proof.",
    utilitiesText:
      "Power comes from Santee Electric Cooperative, Santee Cooper, or the City of Georgetown; water and sewer from the Georgetown County Water & Sewer District or a city system, with a private well and septic on rural lots.",
    permittingText:
      "Ask Georgetown County or the responsible city office for the current manufactured-home application and the parcel-specific checklist. Identify the required documents and who handles each approval.",
    usdaText:
      "Have a participating lender check USDA eligibility for the actual address, home, and application. Do not assume approval or exclusion from an inland or Waccamaw Neck location alone",
  },
  "brunswick-nc": {
    key: "brunswick-nc",
    name: "Brunswick County",
    stateAbbr: "NC",
    windText:
      "Brunswick County is in HUD Wind Zone II. Match the home's documented ratings to the site and confirm the required foundation and installation design. Properties near open water may need additional coastal-exposure review.",
    utilitiesText:
      "Power comes from Brunswick Electric (BEMC) or Duke Energy; water and sewer from Brunswick County Public Utilities, H2GO in the Leland area, or a town system, with a private well and septic on rural lots.",
    permittingText:
      "Start with Brunswick County Central Permitting or the responsible town office for the parcel. Confirm the current application, home-placement requirements, and documents before committing to a model.",
    usdaText:
      "USDA options require an address and application review by a participating lender. A Brunswick County town name or coastal location does not establish eligibility, exclusion, or a no-down-payment loan",
  },
  "columbus-nc": {
    key: "columbus-nc",
    name: "Columbus County",
    stateAbbr: "NC",
    windText:
      "Columbus County is in HUD Wind Zone II. Confirm the home's data-plate ratings and the installation and foundation requirements for the site. An inland location does not establish lower project costs or a storm-safety guarantee.",
    utilitiesText:
      "Power comes from Brunswick EMC, Four County EMC, or Duke Energy; water and sewer from Columbus County Public Utilities or the City of Whiteville, with a private well and septic on rural lots.",
    permittingText:
      "Ask Columbus County Building Inspections or the responsible town office for the current home-placement and permit requirements. Confirm the applicable documents and approval steps for your parcel.",
    usdaText:
      "Ask a participating lender to check the specific Columbus County address, home, and application for USDA eligibility. Being rural or inland alone does not establish loan approval or no-down-payment financing",
  },
};

export function getCounty(key: string): CountyInfo | undefined {
  return counties[key];
}

// Keep town identities and local context stable. Prices and availability belong
// to the chosen listing or model-and-lot estimate, not a town-wide promise.
export const locations: LocationInfo[] = [
  {
    "slug": "myrtle-beach",
    "name": "Myrtle Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29577",
    "headline": "New manufactured homes on land in Myrtle Beach, SC",
    "intro": "Myrtle Beach is the heart of the Grand Strand. Explore a new manufactured home and a lot in or around the city with Home Placer.",
    "paragraphs": [
      "Choose a Clayton, Cavco, or Champion model, then compare the home and a particular Myrtle Beach-area lot together. Looking for a lot without an HOA? Tell us your preference, and ask us to confirm the association status and recorded restrictions for the property.",
      "Being near the ocean does not establish that a parcel can take the home you like. Ask about the responsible city or county office, access, site conditions, utilities, and required approvals before committing. Request current availability and a written home-and-land scope, not a town-wide starting price."
    ],
    "highlights": [
      "Grand Strand setting",
      "Model and lot reviewed together",
      "Ask about current packages"
    ]
  },
  {
    "slug": "conway",
    "name": "Conway",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29526",
    "headline": "New manufactured homes on land in Conway, SC",
    "intro": "Conway, the historic riverfront seat of Horry County, offers an inland setting close to the coast. Explore a new home and a Conway-area lot with Home Placer.",
    "paragraphs": [
      "A riverfront small-town setting, nearby Coastal Carolina University, and access to Myrtle Beach make Conway a useful starting point for your home search. Compare the specific lot, road access, and home footprint rather than assuming every scattered parcel has the same possibilities.",
      "From single-section homes to four-bedroom double-wides, start with the layout and budget you have in mind. We can help you discuss the model and site-work scope; your lender confirms financing terms and payments for the actual project."
    ],
    "highlights": [
      "Historic riverfront town",
      "Close to Coastal Carolina University",
      "Inland Horry County setting"
    ]
  },
  {
    "slug": "loris",
    "name": "Loris",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29569",
    "headline": "New manufactured homes on land in Loris, SC",
    "intro": "Loris offers small-town South Carolina life near the coast and the North Carolina line. Explore a new manufactured home and land in the area.",
    "paragraphs": [
      "If your plans include a garden, a boat, or more room outside, bring those plans into the lot review. Parcel size alone does not settle home placement, access, or property restrictions; confirm what the particular Loris-area lot allows.",
      "Home Placer's models range from efficient single-wides to larger family layouts. Ask about an available land-home listing or an estimate for the model and lot you choose, with setup responsibilities and costs set out in writing."
    ],
    "highlights": [
      "Small-town setting",
      "Near the North Carolina line",
      "Room and access reviewed for your lot"
    ]
  },
  {
    "slug": "longs",
    "name": "Longs",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29568",
    "headline": "New manufactured homes on land in Longs, SC",
    "intro": "Longs sits in north Horry County, near the North Carolina line and North Myrtle Beach. Explore how a new home and a particular lot could fit your plans.",
    "paragraphs": [
      "Longs combines a growing north Horry community with access to the beaches. Compare the lot's location and everyday travel needs with its boundaries, access, utilities, and recorded restrictions.",
      "Choose a Clayton, Cavco, or Champion model to discuss with Home Placer, then ask what the proposed land and setup scope includes. A model photo is not a ready listing; confirm the actual property's availability, price, and remaining work."
    ],
    "highlights": [
      "North Horry County",
      "Near North Myrtle Beach",
      "Current property details available on request"
    ]
  },
  {
    "slug": "aynor",
    "name": "Aynor",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "zip": "29511",
    "headline": "New manufactured homes on land in Aynor, SC",
    "intro": "Aynor is farm-country in western Horry County, known for its rural setting and the Aynor Hoe-Down. Explore a new home and land with Home Placer.",
    "paragraphs": [
      "Whether you bring family land or are considering a lot near Aynor, review the chosen model and parcel together. Ask about access, zoning, water, wastewater, and any recorded restrictions before treating acreage as ready for a home.",
      "Tell us the layout you like and what you already know about the land. We can discuss the home and agreed setup work, with allowances, exclusions, responsibilities, and the closing arrangement confirmed for your project."
    ],
    "highlights": [
      "Western Horry County",
      "Rural setting and Aynor Hoe-Down",
      "Bring your own land questions"
    ]
  },
  {
    "slug": "north-myrtle-beach",
    "name": "North Myrtle Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in North Myrtle Beach, SC",
    "intro": "North Myrtle Beach brought Cherry Grove, Windy Hill, Ocean Drive, and Crescent Beach together in 1968. Explore a new manufactured home and land near this part of the Grand Strand.",
    "paragraphs": [
      "Those four beach communities still have their own character. Start with the part of the area you prefer, then review a specific parcel's home-placement rules, delivery access, utilities, and property restrictions with the responsible office.",
      "For a coastal site, ask about the home's design ratings and the foundation and installation requirements for the actual lot. Home Placer can discuss the proposed home-and-land scope; a participating lender checks any financing program against your address and application."
    ],
    "highlights": [
      "Four distinct beach communities",
      "North Grand Strand setting",
      "Parcel-specific coastal review"
    ]
  },
  {
    "slug": "surfside-beach",
    "name": "Surfside Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New Manufactured Homes on Land in Surfside Beach, SC",
    "intro": "Surfside Beach has called itself The Family Beach since incorporating in 1964. Explore a new home and a lot near this southern Grand Strand community.",
    "paragraphs": [
      "Consider the location you want near Surfside Beach alongside the property's access, utilities, restrictions, and placement rules. The home, land, and remaining setup work should be identified in the listing or written estimate for that address.",
      "A coastal location calls for a site-specific discussion, not a generic wind-speed assurance. Ask the team which design and installation requirements apply, what remains to be approved, and which milestones can be scheduled for your home."
    ],
    "highlights": [
      "The Family Beach",
      "Southern Grand Strand",
      "Home and site requirements checked together"
    ]
  },
  {
    "slug": "socastee",
    "name": "Socastee",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Socastee, SC",
    "intro": "Socastee sits along the Intracoastal Waterway between Myrtle Beach and Conway. Explore a new manufactured home and a lot in this Horry County community.",
    "paragraphs": [
      "The swing bridge, boat traffic, and routes toward Myrtle Beach and Conway are part of Socastee's local setting. Bring the actual parcel into the conversation so access, home placement, utilities, site conditions, and restrictions can be reviewed.",
      "Tell Home Placer your model preference, budget, and target timing. Ask for the property's current status and a written explanation of the land and setup scope; do not infer loan eligibility or a town-wide package price from the area's name."
    ],
    "highlights": [
      "Intracoastal Waterway setting",
      "Between Myrtle Beach and Conway",
      "Ask about the specific home and lot"
    ]
  },
  {
    "slug": "carolina-forest",
    "name": "Carolina Forest",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Carolina Forest, SC",
    "intro": "Carolina Forest lies west of the Intracoastal Waterway between Myrtle Beach and Conway. Discuss a new home and a particular parcel with Home Placer.",
    "paragraphs": [
      "The area's community setting and access to Myrtle Beach and Conway can help you narrow your search. Before choosing a lot, check its zoning, recorded covenants, association status, delivery access, and utility arrangements.",
      "A manufactured-home model and an approved home site are separate decisions. Ask us about model options and the proposed setup scope, then have the responsible office and lender review the actual property and financing requirements."
    ],
    "highlights": [
      "West of the Intracoastal",
      "Between Myrtle Beach and Conway",
      "Check the parcel's placement rules"
    ]
  },
  {
    "slug": "little-river",
    "name": "Little River",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Little River, SC",
    "intro": "Little River is a former fishing village near the North Carolina line, just south of Calabash. Explore a new home and land near its waterfront setting.",
    "paragraphs": [
      "The Intracoastal, marinas, and seafood waterfront give Little River its character. Match the location you like to a lot whose access, boundaries, utilities, and home-placement rules have been checked for your chosen model.",
      "For land near the water, ask about site conditions and applicable home, foundation, and installation requirements. Request a written home-and-land estimate and have your lender check program options for the specific address, rather than assuming coastal or inland eligibility."
    ],
    "highlights": [
      "Fishing-village waterfront",
      "Near Calabash and the state line",
      "Site and scope reviewed for your model"
    ]
  },
  {
    "slug": "garden-city-beach",
    "name": "Garden City Beach",
    "county": "Horry County",
    "countyKey": "horry-sc",
    "headline": "New manufactured homes on land in Garden City Beach, SC",
    "intro": "Garden City Beach sits where Horry meets Georgetown County at the south end of the Grand Strand. Explore a new home and a lot near this coastal community.",
    "paragraphs": [
      "The pier, marsh, and south-end Grand Strand setting can guide your search. Because the area spans county boundaries, start by confirming which authority handles the actual parcel and what placement, access, and utility review it needs.",
      "Ask Home Placer about an available package or a model-and-lot estimate. Confirm the chosen lot's restrictions, coastal site requirements, included work, and remaining approvals in writing; the neighborhood name alone does not establish price, schedule, or financing eligibility."
    ],
    "highlights": [
      "South-end Grand Strand",
      "Horry and Georgetown boundary",
      "Confirm the parcel's responsible authority"
    ]
  },
  {
    "slug": "georgetown",
    "name": "Georgetown",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Georgetown, SC",
    "intro": "Georgetown, founded in 1729, sits where five rivers meet at Winyah Bay. Explore a new manufactured home and a lot in the area with Home Placer.",
    "paragraphs": [
      "From the Winyah Bay waterfront to locations farther inland, begin with the actual parcel rather than a county-wide assumption. Ask which office handles placement, what utilities are available, and which site and delivery questions need an answer.",
      "Choose a model to discuss, then request the land and setup scope, allowances, and exclusions for the property. Any loan program requires a lender's review of your application and the home; being inland or near the coast does not establish approval."
    ],
    "highlights": [
      "Historic Georgetown",
      "Winyah Bay and five rivers",
      "Property-specific home and land review"
    ]
  },
  {
    "slug": "pawleys-island",
    "name": "Pawleys Island",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land near Pawleys Island, SC",
    "intro": "Pawleys Island's seaside setting has drawn visitors since the early 1800s. Explore a new manufactured home and land near this Georgetown County coast.",
    "paragraphs": [
      "Creeks, marshes, and proximity to the Atlantic are part of the area's appeal. They also make the particular parcel important: ask about home-placement rules, access, site conditions, utilities, and property restrictions before choosing a plan.",
      "Ask Home Placer to explain the proposed home and setup work for your lot. Coastal design and installation requirements and any lender's property review must be checked for the address; a nearby project is useful context, not permission or a current price for yours."
    ],
    "highlights": [
      "Georgetown County coast",
      "Creek-and-marsh setting",
      "Review the actual parcel before ordering"
    ]
  },
  {
    "slug": "murrells-inlet",
    "name": "Murrells Inlet",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Murrells Inlet, SC",
    "intro": "Murrells Inlet is known for its saltwater setting and the MarshWalk dining boardwalk. Explore a new home and land near this Grand Strand community.",
    "paragraphs": [
      "Boat traffic and the MarshWalk shape the inlet's local character. Tell us where you want to live and bring the parcel information so the responsible authority, placement rules, utilities, and access can be identified.",
      "Compare an actual land-home listing with a model that still needs to be ordered and installed. Request the property's current status and a written scope; your lender checks available loan options instead of relying on a broad Waccamaw Neck or inland eligibility claim."
    ],
    "highlights": [
      "MarshWalk setting",
      "Grand Strand inlet community",
      "Compare listed homes and ordered projects"
    ]
  },
  {
    "slug": "andrews",
    "name": "Andrews",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Andrews, SC",
    "intro": "Andrews is an inland timber-and-rail town that took root in 1909. Explore a new manufactured home and land near the US-521 corridor.",
    "paragraphs": [
      "If you want an inland setting near Georgetown, start with the home layout and the particular lot you have in mind. Ask about home placement, road and delivery access, water, wastewater, and the property's recorded restrictions.",
      "Home Placer can help you discuss the model and the proposed setup scope. Have a participating lender check the actual address and your application for any USDA option; a rural setting alone does not promise no down payment or approval."
    ],
    "highlights": [
      "Inland Georgetown County",
      "US-521 corridor",
      "Check the address with your lender"
    ]
  },
  {
    "slug": "litchfield-beach",
    "name": "Litchfield Beach",
    "county": "Georgetown County",
    "countyKey": "georgetown-sc",
    "headline": "New manufactured homes on land in Litchfield Beach, SC",
    "intro": "Litchfield Beach lies on the Waccamaw Neck just north of Pawleys Island, near the old Litchfield Plantation setting. Explore a new home and land in the area.",
    "paragraphs": [
      "Consider the location you want on the Neck with the parcel's placement rules, access, utilities, and recorded covenants. Prefer a lot without an HOA? Ask us to confirm the chosen property's association status instead of assuming it from the area.",
      "A coastal home-and-land project needs a site-specific scope and review. Ask what design and installation requirements apply and what is included in the estimate; the lender determines financing options for your application and property."
    ],
    "highlights": [
      "Waccamaw Neck",
      "North of Pawleys Island",
      "Ask about lot restrictions and setup scope"
    ]
  },
  {
    "slug": "leland",
    "name": "Leland",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Leland, NC",
    "intro": "Leland sits across the river from Wilmington in Brunswick County. Discuss a new manufactured home and a particular lot with Home Placer.",
    "paragraphs": [
      "Access to Wilmington and the Cape Fear River helps define Leland's setting. Compare that location with the actual parcel's placement rules, recorded restrictions, road access, and utility arrangements.",
      "Before selecting a home, ask about the model-and-site review and request the included land and setup work in writing. USDA eligibility is checked by address and application, not by assuming all inland Brunswick locations qualify or that Leland is excluded."
    ],
    "highlights": [
      "Brunswick County",
      "Across the river from Wilmington",
      "Parcel and lender review before committing"
    ]
  },
  {
    "slug": "shallotte",
    "name": "Shallotte",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Shallotte, NC",
    "intro": "Shallotte sits on the Shallotte River between Wilmington and Myrtle Beach, serving the South Brunswick Islands. Explore a new home and land in the area.",
    "paragraphs": [
      "Shallotte is a place for shopping and everyday errands near Ocean Isle and Holden Beach. Choose the location you prefer, then check the lot's access, services, recorded restrictions, and home-placement requirements.",
      "For a home near the water or farther inland, ask for the site and setup scope for that property. The required home ratings and installation design and any financing program should be reviewed for the actual parcel, not assumed from nearby towns."
    ],
    "highlights": [
      "Shallotte River setting",
      "South Brunswick Islands area",
      "Written scope for the chosen lot"
    ]
  },
  {
    "slug": "southport",
    "name": "Southport",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Southport, NC",
    "intro": "Southport sits at the mouth of the Cape Fear River in a historic waterfront setting. Explore a new manufactured home and a lot near this Brunswick County town.",
    "paragraphs": [
      "The waterfront and Cape Fear boat traffic give Southport a distinctive setting. Bring the specific parcel into your home search so placement, access, site conditions, utilities, and restrictions can be checked.",
      "Ask Home Placer to distinguish a current listed package from an ordered-home project and explain the remaining work. Confirm the land and setup scope, price, and closing arrangement in writing, and ask your lender to review the home and address for program eligibility."
    ],
    "highlights": [
      "Cape Fear River waterfront",
      "Historic Southport setting",
      "Confirm property status and remaining work"
    ]
  },
  {
    "slug": "oak-island",
    "name": "Oak Island",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Oak Island, NC",
    "intro": "Oak Island has a south-facing shoreline and a year-round coastal community. Explore a new home and a particular lot with Home Placer.",
    "paragraphs": [
      "Living near the shoreline starts with a careful parcel review. Ask the responsible authority about home placement and site requirements, and confirm delivery access, utilities, and recorded property restrictions.",
      "Do not treat a general coastal wind-zone statement as a safety assurance for your home. Ask how the model's design ratings and the foundation and installation requirements fit the site, then request a written home-and-land scope and lender review."
    ],
    "highlights": [
      "South-facing shoreline",
      "Brunswick County coast",
      "Parcel-specific coastal requirements"
    ]
  },
  {
    "slug": "calabash",
    "name": "Calabash",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Calabash, NC",
    "intro": "Calabash, known for its seafood, is a fishing-village setting near the South Carolina line. Explore a new manufactured home and land in the area.",
    "paragraphs": [
      "The waterfront and Calabash-style seafood are part of this small town's identity. Tell us the location and home layout you prefer, then compare the actual lot's access, utilities, placement rules, and restrictions.",
      "Request an estimate that identifies the home, land, setup work, allowances, and exclusions. A beachfront or inland location does not determine a loan on its own; your lender reviews the address, home, and application for available options."
    ],
    "highlights": [
      "Seafood and waterfront setting",
      "Near the South Carolina line",
      "Home and lot estimate on request"
    ]
  },
  {
    "slug": "sunset-beach",
    "name": "Sunset Beach",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Sunset Beach, NC",
    "intro": "Sunset Beach sits at the southern tip of North Carolina's Brunswick Islands, near the state line and the Kindred Spirit mailbox. Explore a new home and land near this part of the coast.",
    "paragraphs": [
      "Choose the coastal or nearby inland setting that interests you, then bring the parcel information into the model discussion. Ask about the responsible office, home-placement rules, access, utilities, and recorded restrictions.",
      "For a coastal lot, confirm the home's ratings and the applicable foundation and installation requirements. Ask for the included land and setup work in writing and have your lender check any financing option for the specific address and application."
    ],
    "highlights": [
      "Southern Brunswick Islands",
      "Near the Kindred Spirit mailbox",
      "Coastal site and scope review"
    ]
  },
  {
    "slug": "ocean-isle-beach",
    "name": "Ocean Isle Beach",
    "county": "Brunswick County",
    "countyKey": "brunswick-nc",
    "headline": "New manufactured homes on land in Ocean Isle Beach, NC",
    "intro": "Ocean Isle Beach sits in the South Brunswick Islands with an east-west shoreline. Explore a new manufactured home and a particular lot near this coastal setting.",
    "paragraphs": [
      "The island and nearby mainland offer different settings to consider. Ask the responsible authority about the actual parcel's home-placement rules, site requirements, and utilities before treating a model as a fit for the lot.",
      "Home Placer can discuss the proposed home and setup scope; ask what remains to be reviewed, approved, and priced. A coastal address is not automatically included in or excluded from USDA financing, and a lender must check the property and application."
    ],
    "highlights": [
      "South Brunswick Islands",
      "Coastal and nearby mainland settings",
      "Confirm placement and financing for the address"
    ]
  },
  {
    "slug": "whiteville",
    "name": "Whiteville",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New manufactured homes on land in Whiteville, NC",
    "intro": "Whiteville is the Columbus County seat, with the North Carolina Museum of Natural Sciences downtown. Explore a new manufactured home and land in the area.",
    "paragraphs": [
      "Start with the part of Whiteville you want to call home, then review the actual lot's access, placement rules, utilities, and restrictions. Inland location alone does not establish lower setup costs or approval for the model you choose.",
      "Tell us about your home and land plans and ask for a written estimate with included work and open questions identified. For a USDA option, have a participating lender check the address, property, and application rather than assume county-wide no-down-payment eligibility."
    ],
    "highlights": [
      "Columbus County seat",
      "Downtown museum setting",
      "Address-specific financing review"
    ]
  },
  {
    "slug": "tabor-city",
    "name": "Tabor City",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New manufactured homes on land in Tabor City, NC",
    "intro": "Tabor City is known as the Yam Capital of the World and for the North Carolina Yam Festival. Explore a new home and a lot in this inland Columbus County town.",
    "paragraphs": [
      "If you are considering a lot near Tabor City, bring its location and the model dimensions into the conversation. Check access, services, home-placement requirements, and recorded restrictions instead of assuming every rural parcel is ready for setup.",
      "Ask Home Placer for the proposed home-and-land scope and confirm the closing arrangement with the team and lender. A town's rural character does not establish no-down-payment eligibility or a discount in wind-design or installation costs."
    ],
    "highlights": [
      "NC Yam Festival setting",
      "Inland Columbus County",
      "Model and parcel review before ordering"
    ]
  },
  {
    "slug": "lake-waccamaw",
    "name": "Lake Waccamaw",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New manufactured homes on land in Lake Waccamaw, NC",
    "intro": "Lake Waccamaw is a Columbus County community on the shore of a Carolina bay lake. Explore a new manufactured home and a lot in the area.",
    "paragraphs": [
      "A lakeside setting and an inland lot can raise different property questions. Start with the actual parcel's home-placement rules, access, site conditions, utilities, and restrictions before choosing a model.",
      "Ask about an available listing or a written estimate for your home and land. Inland location alone does not promise lower setup costs, loan approval, or no down payment; a lender reviews the specific address, home, and application."
    ],
    "highlights": [
      "Carolina bay lake setting",
      "Columbus County",
      "Check site conditions for the chosen home"
    ]
  },
  {
    "slug": "chadbourn",
    "name": "Chadbourn",
    "county": "Columbus County",
    "countyKey": "columbus-nc",
    "headline": "New Manufactured Homes on Land in Chadbourn, NC",
    "intro": "Chadbourn is strawberry country in Columbus County, known for the North Carolina Strawberry Festival. Explore a new manufactured home and land near town.",
    "paragraphs": [
      "The spring festival and small-town setting are part of Chadbourn's character. Match the home layout you like to a lot whose access, placement rules, utilities, and restrictions have been reviewed.",
      "Request a written home-and-land scope that shows what is included and what still needs an answer. USDA options require an address and application review by a participating lender; do not assume county-wide eligibility, a guaranteed price, or one closing for every project."
    ],
    "highlights": [
      "NC Strawberry Festival",
      "Small-town Columbus County",
      "Written scope and lender review"
    ]
  }
];

export const cityGeo: Record<string, { lat: number; lng: number }> = {
  "myrtle-beach": { lat: 33.6891, lng: -78.8867 },
  conway: { lat: 33.836, lng: -79.0478 },
  loris: { lat: 34.0563, lng: -78.8903 },
  longs: { lat: 33.9174, lng: -78.7336 },
  aynor: { lat: 33.9985, lng: -79.1989 },
  "north-myrtle-beach": { lat: 33.816, lng: -78.68 },
  "surfside-beach": { lat: 33.606, lng: -78.974 },
  "socastee": { lat: 33.685, lng: -78.987 },
  "carolina-forest": { lat: 33.78, lng: -78.93 },
  "little-river": { lat: 33.873, lng: -78.616 },
  "garden-city-beach": { lat: 33.583, lng: -79.0 },
  "georgetown": { lat: 33.376, lng: -79.294 },
  "pawleys-island": { lat: 33.434, lng: -79.122 },
  "murrells-inlet": { lat: 33.551, lng: -79.034 },
  "andrews": { lat: 33.451, lng: -79.563 },
  "litchfield-beach": { lat: 33.471, lng: -79.108 },
  "leland": { lat: 34.256, lng: -78.045 },
  "shallotte": { lat: 33.973, lng: -78.382 },
  "southport": { lat: 33.921, lng: -78.02 },
  "oak-island": { lat: 33.908, lng: -78.137 },
  "calabash": { lat: 33.89, lng: -78.566 },
  "sunset-beach": { lat: 33.88, lng: -78.512 },
  "ocean-isle-beach": { lat: 33.895, lng: -78.428 },
  "whiteville": { lat: 34.34, lng: -78.706 },
  "tabor-city": { lat: 34.149, lng: -78.873 },
  "lake-waccamaw": { lat: 34.316, lng: -78.5 },
  "chadbourn": { lat: 34.323, lng: -78.826 },
};

export function getLocation(slug: string): LocationInfo | undefined {
  return locations.find((l) => l.slug === slug);
}

// State abbreviation for a curated `site.locations` entry (which only carries
// slug + name). Resolves through the full location → its county → stateAbbr, so
// the NC towns (Leland, Shallotte, Southport, Calabash, Whiteville) label
// correctly instead of everything defaulting to "SC". Falls back to "SC" only if
// a slug can't be resolved (shouldn't happen for the curated subset).
export function stateAbbrForSlug(slug: string): "SC" | "NC" {
  const loc = getLocation(slug);
  return (loc && getCounty(loc.countyKey)?.stateAbbr) || "SC";
}

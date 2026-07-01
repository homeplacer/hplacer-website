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

// Verified, county-accurate facts (wind zone, utilities, permitting, USDA) used
// by the "Building a home in {town}" block. Sourced 2026-06-25 — the NC counties
// differ from the SC coast, and inland Columbus County NC is Wind Zone I.
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
      "Horry County is in HUD Wind Zone II, so homes here are built and rated for the ~100 mph coastal winds the Grand Strand can see.",
    utilitiesText:
      "Power comes from Horry Electric Cooperative, Santee Cooper, or Duke Energy; water and sewer from Grand Strand Water & Sewer Authority or a city system, with a private well and septic on rural lots.",
    permittingText:
      "Placement and setup permits go through Horry County (or the city, for in-town lots). We handle the whole process for you.",
    usdaText:
      "most of rural Horry County — Conway, Loris, Longs, Aynor — qualifies for USDA $0-down (core Myrtle Beach and North Myrtle Beach usually don't)",
  },
  "georgetown-sc": {
    key: "georgetown-sc",
    name: "Georgetown County",
    stateAbbr: "SC",
    windText:
      "Georgetown County is in HUD Wind Zone II, so homes are built and rated for ~100 mph coastal winds.",
    utilitiesText:
      "Power comes from Santee Electric Cooperative, Santee Cooper, or the City of Georgetown; water and sewer from the Georgetown County Water & Sewer District or a city system, with a private well and septic on rural lots.",
    permittingText:
      "Manufactured-home permits go through the Georgetown County Building Department (or the City of Georgetown). We handle the process.",
    usdaText:
      "inland Georgetown County — Andrews and the US-521 farm corridor — is largely USDA $0-down eligible, while the resort Waccamaw Neck often isn't",
  },
  "brunswick-nc": {
    key: "brunswick-nc",
    name: "Brunswick County",
    stateAbbr: "NC",
    windText:
      "Brunswick County is in HUD Wind Zone II, so homes are built and rated for ~100 mph coastal winds (oceanfront lots can need added Exposure-D certification).",
    utilitiesText:
      "Power comes from Brunswick Electric (BEMC) or Duke Energy; water and sewer from Brunswick County Public Utilities, H2GO in the Leland area, or a town system, with a private well and septic on rural lots.",
    permittingText:
      "Manufactured-home permits go through Brunswick County Central Permitting in Bolivia (or the town). We handle the process.",
    usdaText:
      "inland Brunswick County — Bolivia, Supply, Ash, Winnabow — is largely USDA $0-down eligible, while the Leland area and beach towns are more often excluded",
  },
  "columbus-nc": {
    key: "columbus-nc",
    name: "Columbus County",
    stateAbbr: "NC",
    windText:
      "Columbus County is inland — HUD Wind Zone I — so homes are built to the standard (non-coastal) wind rating, which can keep your cost down versus the beach counties.",
    utilitiesText:
      "Power comes from Brunswick EMC, Four County EMC, or Duke Energy; water and sewer from Columbus County Public Utilities or the City of Whiteville, with a private well and septic on rural lots.",
    permittingText:
      "Manufactured-home permits go through Columbus County Building Inspections (or the town). We handle the process.",
    usdaText:
      "almost the entire county — including Whiteville, Tabor City, Lake Waccamaw, and Chadbourn — qualifies for USDA $0-down",
  },
};

export function getCounty(key: string): CountyInfo | undefined {
  return counties[key];
}

export const locations: LocationInfo[] = [
  {
    slug: "myrtle-beach",
    name: "Myrtle Beach",
    county: "Horry County",
    countyKey: "horry-sc",
    zip: "29577",
    headline: "New manufactured homes on land in Myrtle Beach, SC",
    intro:
      "Myrtle Beach is the heart of the Grand Strand — and you don't have to rent forever to live near it. Home Placer puts brand-new manufactured homes on land in and around Myrtle Beach, from the low $200s.",
    paragraphs: [
      "Beachside living usually comes with a beachside price tag. Our land-home packages change that: a new Clayton, Cavco, or Champion home set on its own lot, with no HOA and one simple price.",
      "We handle the whole thing — finding or using your land, permits, delivery, foundation, and utility hookups — so you get a move-in-ready home a short drive from the ocean without the coastal markup.",
    ],
    highlights: ["Minutes from the Grand Strand", "No HOA — own your land", "Packages from the low $200s"],
  },
  {
    slug: "conway",
    name: "Conway",
    county: "Horry County",
    countyKey: "horry-sc",
    zip: "29526",
    headline: "New manufactured homes on land in Conway, SC",
    intro:
      "Conway — the historic riverfront seat of Horry County — offers more land for your money just inland from the coast. Home Placer pairs new homes with lots across the Conway area.",
    paragraphs: [
      "If you want a bigger yard, mature trees, and a small-town feel while staying close to Myrtle Beach jobs and beaches, Conway is hard to beat. Scattered lots here mean your home isn't boxed into a subdivision.",
      "From single-section homes to spacious four-bedroom double-wides, we'll match you to a model, a Conway-area lot, and a payment that works — then set it up move-in ready.",
    ],
    highlights: ["More land, inland value", "Close to Coastal Carolina University", "Riverfront small-town charm"],
  },
  {
    slug: "loris",
    name: "Loris",
    county: "Horry County",
    countyKey: "horry-sc",
    zip: "29569",
    headline: "New manufactured homes on land in Loris, SC",
    intro:
      "Loris is small-town South Carolina at its best — quiet, friendly, and affordable. It's one of the best places on the Grand Strand to own a new home on real acreage.",
    paragraphs: [
      "Land goes further in Loris, which makes it ideal for a land-home package. Spread out, plant a garden, park the boat — all without an HOA telling you no.",
      "Home Placer carries homes that fit Loris life, from efficient single-wides to roomy family floor plans, and we handle the setup from permit to keys.",
    ],
    highlights: ["Affordable acreage", "Rural quiet, no HOA", "Easy reach to the coast and NC line"],
  },
  {
    slug: "longs",
    name: "Longs",
    county: "Horry County",
    countyKey: "horry-sc",
    zip: "29568",
    headline: "New manufactured homes on land in Longs, SC",
    intro:
      "Longs sits in fast-growing north Horry County, close to the North Carolina line and an easy drive to North Myrtle Beach. It's a smart spot to put down roots in a new home on land.",
    paragraphs: [
      "Buyers love Longs for its mix of newer growth and breathing room. You get newer infrastructure and quick beach access while still finding lots with space.",
      "We'll place a brand-new Clayton, Cavco, or Champion home on a Longs-area lot — bundled, set, and ready — so you skip the rent cycle and start building equity.",
    ],
    highlights: ["Growing north Horry community", "Minutes to North Myrtle Beach", "Room to spread out"],
  },
  {
    slug: "aynor",
    name: "Aynor",
    county: "Horry County",
    countyKey: "horry-sc",
    zip: "29511",
    headline: "New manufactured homes on land in Aynor, SC",
    intro:
      "Aynor is proud farm-country in western Horry County — wide-open land, friendly neighbors, and home of the Aynor Hoe-Down. If you want acreage and a true rural setting, this is your spot.",
    paragraphs: [
      "Aynor's larger lots make the land-home package shine: a new home, your own land, and no association fees, all for one price you can actually plan around.",
      "Whether you're bringing family land or buying a lot, Home Placer handles the permits, delivery, and setup, and gets you into a new home built for Carolina living.",
    ],
    highlights: ["True country acreage", "Tight-knit community", "Bring your own land or use ours"],
  },
  {
    slug: "north-myrtle-beach",
    name: "North Myrtle Beach",
    county: "Horry County",
    countyKey: "horry-sc",
    headline: "New manufactured homes on land in North Myrtle Beach, SC",
    intro: "North Myrtle Beach pulled four old beach towns into one in 1968, and that put-it-together spirit still fits today. Home Placer pairs a brand-new Clayton, Cavco, or Champion home with land here as one package, one price, one closing.",
    paragraphs: ["When North Myrtle Beach was created in 1968, it stitched together Cherry Grove, Windy Hill, Ocean Drive, and Crescent Beach — four communities that each kept their own feel. We work the same way: you pick the home and you pick the land, and we handle the rest as one project. That means finding or using your lot, pulling permits, delivering the home, setting it on a permanent foundation, and getting water, power, and sewer or septic hooked up. One closing, one number, and no HOA on our land-home packages.", "Because this is coastal Horry County, every home we place is built to a HUD Zone II wind rating — roughly a 100 mph coastal standard — so it is made for where you are putting it. Packages start in the low $200s, and we will walk you through FHA, VA, USDA, and conventional financing in plain language. In many of the more rural areas around North Myrtle Beach, USDA $0-down can be on the table, and we will tell you straight whether your spot qualifies."],
    highlights: ["One package, one price, one closing", "Built to Zone II coastal wind rating", "No HOA on land-home packages"],
  },
  {
    slug: "surfside-beach",
    name: "Surfside Beach",
    county: "Horry County",
    countyKey: "horry-sc",
    headline: "New Manufactured Homes on Land in Surfside Beach, SC",
    intro: "Surfside Beach has called itself \"The Family Beach\" since it incorporated in 1964, and that easygoing, family-first feel is exactly the kind of place Home Placer loves to put a brand-new home. We pair a new Clayton, Cavco, or Champion home with land into one package, one price, one closing.",
    paragraphs: ["Buying near Surfside Beach usually means juggling a land purchase, a home order, permits, a foundation, and utility hookups all at once. Home Placer handles the whole thing for you. We help you find and use the land, set a brand-new home on a permanent foundation, pull the permits, and get the power, water, and septic or sewer hooked up so you move into a finished home, not a project. It's one price and one closing, with packages starting in the low $200s and no HOA on our land-home packages.", "Because Surfside Beach sits in coastal Horry County, our homes are built to the HUD Zone II wind standard, rated for roughly 100 mph coastal winds, so you get a new home built for where it actually stands. Financing is straightforward too: we work with FHA, VA, conventional, and USDA loans, and many of the more rural spots around the Grand Strand still qualify for USDA $0-down. Tell us what you're after and we'll talk you through it plainly, like a neighbor would."],
    highlights: ["One price, one closing", "Coastal 100 mph wind-rated build", "No HOA, low $200s start"],
  },
  {
    slug: "socastee",
    name: "Socastee",
    county: "Horry County",
    countyKey: "horry-sc",
    headline: "New manufactured homes on land in Socastee, SC",
    intro: "Right along the Intracoastal Waterway between Myrtle Beach and Conway, Socastee gives you elbow room and a real Horry County address. Home Placer sets a brand-new home on a piece of it and hands you one price, one closing.",
    paragraphs: ["Socastee is one of Horry County's biggest unincorporated communities, around 25,000 neighbors spread out along the waterway, with the swing bridge, the boat traffic, and an easy run into Myrtle Beach or back toward Conway. It's the kind of place where you can still find land with breathing room. Home Placer pairs a new Clayton, Cavco, or Champion home with that land as a single package: we help you find or use the lot, pull the permits, deliver and set the home on a permanent foundation, and get the water, power, and septic or sewer hooked up. One price, one closing, and no HOA on our land-home packages.", "Because Socastee sits in coastal Horry County, our homes are built to the HUD Zone II wind standard, rated for roughly 100 mph coastal winds, so what we set here is made for where you actually live. Packages start in the low $200s, and we work with FHA, VA, USDA, and conventional financing. A lot of the more rural land around Socastee falls inside USDA-eligible areas, which can open the door to $0 down for buyers who qualify. Tell us your budget and the kind of lot you have in mind, and we'll walk you through honest numbers and real options."],
    highlights: ["Land + home, one closing", "Built for Zone II coastal winds", "USDA $0-down on many lots"],
  },
  {
    slug: "carolina-forest",
    name: "Carolina Forest",
    county: "Horry County",
    countyKey: "horry-sc",
    headline: "New manufactured homes on land in Carolina Forest, SC",
    intro: "Carolina Forest is one of the fastest-growing corners of Horry County — a master-planned community west of the Intracoastal, tucked right between Myrtle Beach and Conway. Home Placer puts a brand-new home on land here as one package, one price, one closing.",
    paragraphs: ["Living in Carolina Forest means you're minutes from the beach but settled in your own quiet spot west of the waterway, with Conway just up the road for everyday errands. Because it's an unincorporated, still-growing area, there's real opportunity to find a parcel and pair it with a brand-new Clayton, Cavco, or Champion home. We handle the whole thing — finding or using your land, permits, delivery, a permanent foundation, and utility hookups — so you sign once and get the keys.", "Our land-home packages start in the low $200s with no HOA, and we'll walk you through FHA, VA, USDA, or conventional financing to find what fits. Out in the more rural stretches around Carolina Forest, many buyers qualify for USDA $0-down. Every home is built to this coast's HUD Zone II standard — roughly a 100 mph wind rating — so it's made for where you're putting it. No guesswork, no surprises, just a straight answer from a local who knows the area."],
    highlights: ["West of the Intracoastal", "Packages from the low $200s", "No HOA on our land"],
  },
  {
    slug: "little-river",
    name: "Little River",
    county: "Horry County",
    countyKey: "horry-sc",
    headline: "New manufactured homes on land in Little River, SC",
    intro: "Little River is the oldest settlement in Horry County — a former 1700s fishing village tucked right against the North Carolina line, just south of Calabash. Home Placer puts a brand-new home and a piece of that land together as one package, one price, one closing.",
    paragraphs: ["There's a particular pull to Little River. It started as a fishing village back in the 1700s and it still has that working-waterfront feel — the Intracoastal, the marinas, the fresh seafood off the boats near Calabash. Home Placer helps you settle here without the usual runaround: we pair a brand-new Clayton, Cavco, or Champion home with land and handle the whole chain — finding or using your land, permits, delivery, a permanent foundation, and utility hookups. One team, one price, one closing day. Packages start in the low $200s, and our land-home packages carry no HOA.", "Because this is coastal Horry County, every home we set goes on a permanent foundation built to the area's roughly 100-mph coastal wind rating, so it's made for where it stands. And out in the more rural stretches around Little River — away from the core Myrtle Beach area — many addresses qualify for USDA $0-down financing; we also work with FHA, VA, and conventional. Tell us the spot you have in mind, or let us help you find one, and we'll give you honest numbers and a clear path from raw land to keys in hand."],
    highlights: ["One price, one closing", "No HOA on your land", "Built for the coast, ~100 mph"],
  },
  {
    slug: "garden-city-beach",
    name: "Garden City Beach",
    county: "Horry County",
    countyKey: "horry-sc",
    headline: "New manufactured homes on land in Garden City Beach, SC",
    intro: "Garden City Beach sits right where Horry meets Georgetown County at the south end of the Grand Strand — an unincorporated stretch of the coast with no city hall and no pretense. Home Placer puts a brand-new home and the land it sits on together as one package, one price, one closing.",
    paragraphs: ["Garden City has always been the quieter, more easygoing end of the Strand — close enough to the pier and the marsh to feel like the beach, far enough from the Myrtle Beach crowds to feel like home. We pair a new Clayton, Cavco, or Champion home with a piece of land out here and handle the whole job: finding or using your lot, permits, delivery, a permanent foundation, and getting your water, power, and sewer hooked up. You deal with us once, you sign once, and there's no HOA on our land-home packages.", "Because we're this close to the coast, every home we set in the Garden City area is built to a HUD Zone II wind rating — roughly 100 mph — so it's made for life near the water from day one. Packages start in the low $200s, and depending on where your land falls, you may qualify for USDA $0-down financing; we also work with FHA, VA, and conventional. Tell us what you're after and we'll walk you through honest numbers for this part of Horry and Georgetown County."],
    highlights: ["South-end Grand Strand living", "Built for Zone II coastal wind", "No HOA, one closing"],
  },
  {
    slug: "georgetown",
    name: "Georgetown",
    county: "Georgetown County",
    countyKey: "georgetown-sc",
    headline: "New manufactured homes on land in Georgetown, SC",
    intro: "Put down roots in Georgetown — South Carolina's third-oldest city, founded in 1729 where five rivers meet at Winyah Bay. Home Placer pairs a brand-new home with the right piece of land here, all in one package, one price, one closing.",
    paragraphs: ["Living near the Winyah Bay waterfront comes with a few real-world details, and we handle them so you don't have to chase them down. Georgetown County sits in coastal South Carolina's wind zone, so we build on a permanent foundation rated to stand up to roughly 100 mph coastal winds, then take care of the permits, delivery, and utility hookups before you get your keys. You pick a brand-new Clayton, Cavco, or Champion home; we put it on land with no HOA strings attached.", "How you finance it can hinge on where in the county you land. Out in the inland parts — Andrews and along the US-521 corridor — many parcels qualify for USDA $0-down loans, while properties out on the Waccamaw Neck resort side often don't. We'll walk you through which option fits your spot, whether that's FHA, VA, USDA, or conventional, and give you a straight answer on what your land-home package will actually cost. Packages start in the low $200s."],
    highlights: ["One price, one closing", "USDA $0-down inland options", "No HOA on your land"],
  },
  {
    slug: "pawleys-island",
    name: "Pawleys Island",
    county: "Georgetown County",
    countyKey: "georgetown-sc",
    headline: "New manufactured homes on land near Pawleys Island, SC",
    intro: "Pawleys Island is one of the oldest seaside resorts on the East Coast, with summer homes dating back to the early 1800s. Home Placer puts a brand-new home on a piece of this Georgetown County coast for you — one package, one price, one closing.",
    paragraphs: ["Folks have been coming to Pawleys Island for two centuries to slow down, and that easygoing, creek-and-marsh way of life is exactly what we want to set you up to enjoy. We pair a new Clayton, Cavco, or Champion home with land and handle the whole road: finding or using your lot, permits, delivery, a permanent foundation, and utility hookups. Packages start in the low $200s, with FHA, VA, USDA, and conventional financing on the table, and no HOA on our land-home packages.", "A couple of honest local notes so there are no surprises. This is coastal South Carolina, so the homes we place here are built to a HUD Zone II wind rating, roughly 100 mph, which is the right call this close to the Atlantic. On financing, USDA's $0-down program leans toward the inland stretches like Andrews and the US-521 corridor; the Waccamaw Neck right out on the water often falls outside that map. Tell us where you're looking and we'll tell you straight what your land and loan options really are."],
    highlights: ["One package, one price, one closing", "New homes from the low $200s", "No HOA, coastal-rated build"],
  },
  {
    slug: "murrells-inlet",
    name: "Murrells Inlet",
    county: "Georgetown County",
    countyKey: "georgetown-sc",
    headline: "New manufactured homes on land in Murrells Inlet, SC",
    intro: "In the Seafood Capital of South Carolina, Home Placer puts a brand-new home and a piece of land together as one package, one price, one closing — so you can spend your evenings on the MarshWalk, not buried in paperwork.",
    paragraphs: ["Murrells Inlet runs on saltwater and good food — the MarshWalk dining boardwalk, boats heading out at dawn, and that easy inlet pace. We help you plant roots near all of it without the headache of piecing things together yourself. Home Placer pairs a new Clayton, Cavco, or Champion home with land and handles the whole job: finding and using the land, permits, delivery, a permanent foundation, and utility hookups. One team, one price, one closing — and no HOA on our land-home packages. Most start in the low $200s.", "Because this is coastal Georgetown County, our homes are built and anchored to HUD Wind Zone II — rated for the roughly 100 mph winds the coast can see — so your home is set right for where it sits. On financing, we work with FHA, VA, USDA, and conventional loans. The resort Waccamaw Neck right around Murrells Inlet often isn't USDA $0-down eligible, but inland stretches like Andrews and the US-521 corridor frequently are, so it's worth a quick, honest conversation about what fits your land and your budget. Either way, you'll get straight answers from us."],
    highlights: ["Minutes from the MarshWalk", "Land plus new home, one closing", "No HOA, from the low $200s"],
  },
  {
    slug: "andrews",
    name: "Andrews",
    county: "Georgetown County",
    countyKey: "georgetown-sc",
    headline: "New manufactured homes on land in Andrews, SC",
    intro: "In Andrews, the little timber-and-rail town that took root back in 1909, Home Placer pairs a brand-new home with a piece of land as one package, one price, one closing. No guesswork, no juggling three deals at once.",
    paragraphs: ["Andrews sits inland, about 18 miles up from Georgetown, where there's still room to spread out and land that doesn't run what it does closer to the coast. We pair a brand-new Clayton, Cavco, or Champion home with a lot here and handle the whole job: finding or using your land, permits, delivery, a permanent foundation, and getting water, power, and septic hooked up. You get one set of numbers and one closing day instead of chasing a builder, a lender, and a land seller all at the same time. Packages start in the low $200s, and there's no HOA on our land-home packages.", "Because Andrews sits inland along the US-521 corridor, a lot of this area is USDA-eligible, which can mean a $0-down loan if you qualify. We also work with FHA, VA, and conventional financing. Homes out here are built to Georgetown County's coastal HUD Zone II wind standard, so you get a sturdy, code-right home set on a permanent foundation. We're licensed and local, and we'll walk you through every step in plain English. Come tell us what you're after and we'll show you what's possible in Andrews."],
    highlights: ["One price, one closing", "Often USDA $0-down eligible", "No HOA, room to spread out"],
  },
  {
    slug: "litchfield-beach",
    name: "Litchfield Beach",
    county: "Georgetown County",
    countyKey: "georgetown-sc",
    headline: "New manufactured homes on land in Litchfield Beach, SC",
    intro: "Litchfield Beach sits on the Waccamaw Neck just north of Pawleys Island, a residential and resort stretch that grew up from the old Litchfield Plantation. Home Placer puts a brand-new home and a piece of this land together as one package, one price, one closing.",
    paragraphs: ["If you've ever driven the Neck and wished you could plant roots here without taking on a fixer-upper or an HOA's rulebook, that's exactly what we do. We pair a new Clayton, Cavco, or Champion home with land near Litchfield Beach and handle the whole package start to finish: finding and prepping the lot, permits, delivery, a permanent foundation, and getting your water and power hooked up. You get one price and one closing instead of juggling a builder, a lender, and a land deal separately. No HOA on our land-home packages, and pricing starts in the low $200s.", "Being this close to the coast, homes out here are built to a HUD Zone II standard, rated for roughly 100 mph coastal winds, so your new place is set up for Waccamaw Neck weather from day one. Financing is flexible too: FHA, VA, conventional, and USDA $0-down where the property qualifies. The Neck itself often isn't USDA-eligible, but inland spots like Andrews and the US-521 corridor frequently are, and we'll tell you straight which programs fit the exact lot you're looking at. No guesswork, no fine-print surprises."],
    highlights: ["One price, one closing, no HOA", "Built for Zone II coastal winds", "FHA, VA, USDA, conventional"],
  },
  {
    slug: "leland",
    name: "Leland",
    county: "Brunswick County",
    countyKey: "brunswick-nc",
    headline: "New manufactured homes on land in Leland, NC",
    intro: "Leland is the largest and fastest-growing town in Brunswick County—about 33,000 people and counting—sitting just across the river from Wilmington. Home Placer puts a brand-new home and the land it sits on together as one package, one price, one closing.",
    paragraphs: ["Growing this fast, Leland's appeal is simple: you get Brunswick County living with downtown Wilmington and the Cape Fear River a short drive away. We pair a new Clayton, Cavco, or Champion home with a piece of land and handle the parts that usually trip people up—finding and prepping the lot, permits, delivery, a permanent foundation, and getting your water and power hooked up. You deal with us once, not a dozen contractors, and there's no HOA on our land-home packages. Packages start in the low $200s.", "A couple of honest local notes. Leland is coastal North Carolina, so homes here are built and anchored to HUD Wind Zone II (roughly a 100 mph coastal rating)—we engineer for it, you don't have to think about it. On financing, USDA's $0-down program leans toward inland Brunswick areas like Bolivia, Supply, Ash, and Winnabow, and Leland is more often outside that map—but FHA, VA, and conventional are all on the table, and we'll walk you through which one actually fits your situation. No guessing, no jargon, just a straight answer."],
    highlights: ["One package, one price, one closing", "No HOA on your land", "Minutes from Wilmington"],
  },
  {
    slug: "shallotte",
    name: "Shallotte",
    county: "Brunswick County",
    countyKey: "brunswick-nc",
    headline: "New manufactured homes on land in Shallotte, NC",
    intro: "Set right on the Shallotte River about halfway between Wilmington and Myrtle Beach, Shallotte is the commercial hub of the South Brunswick Islands. Home Placer puts a brand-new home and a piece of land together as one package, one price, one closing.",
    paragraphs: ["Shallotte is where folks from Ocean Isle, Holden Beach, and the surrounding South Brunswick Islands come to shop, eat, and run errands, so a home here keeps you close to the everyday stuff while the beaches stay a short drive away. We pair a new Clayton, Cavco, or Champion home with land and handle the whole job for you: finding or using your lot, permits, delivery, a permanent foundation, and getting water, power, and septic or sewer hooked up. Packages start in the low $200s, and our land-home packages carry no HOA.", "Because Shallotte sits in coastal Brunswick County, your home is built and anchored to the area's HUD Zone II wind standard (around a 100 mph coastal rating), and lots right on the water may need extra exposure engineering. On the money side, financing runs FHA, VA, USDA, or conventional. Pockets just inland of town, like Supply, Ash, and Bolivia, often qualify for USDA's $0-down program, while spots closer to the beaches are more often excluded. We will tell you straight which programs your specific lot can use before you ever sign anything."],
    highlights: ["One price, one closing", "No HOA on land-home packages", "Built for coastal Zone II winds"],
  },
  {
    slug: "southport",
    name: "Southport",
    county: "Brunswick County",
    countyKey: "brunswick-nc",
    headline: "New manufactured homes on land in Southport, NC",
    intro: "Own a brand-new home on your own land in Southport, the historic waterfront town at the mouth of the Cape Fear River. Home Placer pairs a new Clayton, Cavco, or Champion home with land as one package, one price, one closing.",
    paragraphs: ["Southport has worn many hats over the years, from a former Brunswick County seat to the riverside town people now drive in just to walk the waterfront and watch the boats come up the Cape Fear. We help you put down real roots here with a brand-new home set on a permanent foundation on your own piece of land. One Home Placer package covers the land, the home, the permits, delivery, the foundation, and your utility hookups, so you sign once and get the keys to a place that is finished and ready, not a project you have to chase.", "Because Southport sits right on the coast, we build to the area's wind requirements (roughly a 100 mph coastal rating, with a closer look at exposure on lots near open water) so your home is sized up for where it actually stands. We will also walk you straight through financing, including FHA, VA, USDA, and conventional options, and tell you honestly which fit your situation, since some coastal addresses fall outside USDA's $0-down map while many nearby inland spots like Bolivia, Supply, and Winnabow still qualify. Packages start in the low $200s, there is no HOA on our land-home packages, and you always get a plain, real answer from a licensed local team."],
    highlights: ["One price, one closing", "New home on coastal-rated land", "FHA, VA, USDA, conventional"],
  },
  {
    slug: "oak-island",
    name: "Oak Island",
    county: "Brunswick County",
    countyKey: "brunswick-nc",
    headline: "New manufactured homes on land in Oak Island, NC",
    intro: "Oak Island is one of the few North Carolina beaches that faces south, and it's the most populous of Brunswick County's barrier-island towns. Home Placer puts a brand-new home on land here as one package, one price, one closing.",
    paragraphs: ["Living on Oak Island means a south-facing shoreline, a real year-round community, and the kind of laid-back coastal pace that keeps people here for good. Home Placer pairs a brand-new Clayton, Cavco, or Champion home with land into a single package starting in the low $200s. We handle the whole thing: finding and using the land, permits, delivery, a permanent foundation, and utility hookups. One price, one closing, and no HOA on our land-home packages.", "Building this close to the ocean has its own rules, and we know them. Oak Island sits in a coastal high-wind area (HUD Wind Zone II, roughly a 100 mph rating), and lots nearest the beach can call for extra Exposure-D engineering. We size and anchor every home to meet those coastal requirements, so it's done right the first time. Financing is flexible too, with FHA, VA, USDA, and conventional options, and our team will walk you through which one fits your situation. Tell us what you're after and we'll show you what's possible on Oak Island."],
    highlights: ["One package, one price, one closing", "No HOA on our land-home packages", "Built for coastal Zone II wind"],
  },
  {
    slug: "calabash",
    name: "Calabash",
    county: "Brunswick County",
    countyKey: "brunswick-nc",
    headline: "New manufactured homes on land in Calabash, NC",
    intro: "In Calabash, the self-proclaimed Seafood Capital of the World right at the SC line, Home Placer pairs a brand-new home with land as one package, one price, one closing. No HOA on our land-home packages.",
    paragraphs: ["Calabash is a small fishing village with a big name — it lent its identity to Calabash-style fried seafood, and folks drive in from both Carolinas for a plate down by the waterfront. We think a home here should be just as honest and unfussy as that meal. Home Placer builds new Clayton, Cavco, and Champion homes onto land in and around Calabash, and we handle the parts that usually trip people up: finding or using your land, permits, delivery, a permanent foundation, and getting your water and power hooked up. You get one price and one closing instead of juggling a builder, a lender, and a land seller separately.", "Because Calabash sits in coastal Brunswick County, homes here are built to a HUD Zone II wind rating (roughly 100 mph), and a beachfront lot may call for an Exposure-D upgrade — we sort that out for your specific parcel so it's done right the first time. Packages start in the low $200s, and we work with FHA, VA, USDA, and conventional financing. Keep in mind the beach-side towns are more often excluded from USDA's $0-down map, so if that zero-down path matters to you, ask us about inland Brunswick options like Bolivia, Supply, Ash, and Winnabow. Either way, we'll give you a straight answer."],
    highlights: ["One price, one closing", "No HOA on our packages", "Built for coastal wind zones"],
  },
  {
    slug: "sunset-beach",
    name: "Sunset Beach",
    county: "Brunswick County",
    countyKey: "brunswick-nc",
    headline: "New manufactured homes on land in Sunset Beach, NC",
    intro: "Sunset Beach sits at the southern tip of NC's Brunswick Islands, right up against the South Carolina line and home to the famous Kindred Spirit mailbox. Home Placer puts a brand-new home and a piece of this corner of the coast together as one package.",
    paragraphs: ["With Home Placer you get a brand-new Clayton, Cavco, or Champion home set on land near Sunset Beach — one package, one price, one closing. We handle the whole thing: finding or working with your land, the permits, delivery, a permanent foundation, and the utility hookups. No HOA on our land-home packages, and packages start in the low $200s. Financing runs through FHA, VA, USDA, and conventional loans.", "Sunset Beach is coastal NC, which means homes here are built to a HUD Zone II standard rated for roughly 100 mph winds, and beachfront lots can call for an Exposure-D rating — we know how to spec a home that meets the code for your exact lot. USDA $0-down financing tends to fit better on the inland Brunswick County land around Bolivia, Supply, Ash, and Winnabow than on the beach itself, so if zero-down matters to you, we'll walk through honestly where it can and can't apply. Either way, we'll show you real numbers before you commit."],
    highlights: ["One price, one closing", "No HOA on our packages", "Built for coastal wind code"],
  },
  {
    slug: "ocean-isle-beach",
    name: "Ocean Isle Beach",
    county: "Brunswick County",
    countyKey: "brunswick-nc",
    headline: "New manufactured homes on land in Ocean Isle Beach, NC",
    intro: "Ocean Isle Beach sits right in the middle of the South Brunswick Islands, and its east-west run is the rare spot where you can watch the sun come up and go down over water. Home Placer puts a brand-new home on land here as one package, one price, one closing.",
    paragraphs: ["Home Placer pairs a new Clayton, Cavco, or Champion home with a piece of Ocean Isle Beach land and handles the whole thing: finding and prepping the lot, permits, delivery, a permanent foundation, and utility hookups. You sign once and get the keys, with no HOA on our land-home packages. Packages start in the low $200s, and we'll walk financing with you through FHA, VA, USDA, or conventional.", "Building this close to the water means doing it right. Brunswick County sits in HUD Wind Zone II with a coastal rating around 100 mph, and beachfront lots can call for an Exposure-D build, so we spec every home for where it actually goes. Worth knowing up front: USDA's $0-down program leans toward the inland Brunswick towns like Bolivia, Supply, Ash, and Winnabow, while the beach itself is more often outside that map, which is exactly the kind of thing we lay out plainly before you settle on a lot."],
    highlights: ["Sunrise and sunset over water", "One price, one closing", "No HOA, low $200s start"],
  },
  {
    slug: "whiteville",
    name: "Whiteville",
    county: "Columbus County",
    countyKey: "columbus-nc",
    headline: "New manufactured homes on land in Whiteville, NC",
    intro: "In Whiteville, the Columbus County seat, Home Placer puts a brand-new home and the land it sits on into one package, one price, and one closing. No piecing it together yourself.",
    paragraphs: ["You already know Whiteville as the kind of town where you can spend a free afternoon at the NC Museum of Natural Sciences right downtown and still be home in minutes. We want owning here to feel just as straightforward. Home Placer pairs a new Clayton, Cavco, or Champion home with a piece of Columbus County land and handles the parts that usually trip people up: finding or using the land, permits, delivery, a permanent foundation, and getting your water, power, and septic hooked up. You get a clear price starting in the low $200s and a single closing, with no HOA on our land-home packages.", "Whiteville sits inland, away from the coast, so our homes here carry a standard (non-coastal) Zone I wind rating that can keep your cost lower than what you'd pay over in the beach counties. And because nearly all of Columbus County, Whiteville included, is USDA-eligible, many buyers here can qualify for $0-down financing. We also work with FHA, VA, and conventional loans, so we can talk through what actually fits your situation. No pressure, just honest answers from folks who know this corner of North Carolina."],
    highlights: ["USDA $0-down eligible", "One price, one closing", "Inland Zone I can cost less"],
  },
  {
    slug: "tabor-city",
    name: "Tabor City",
    county: "Columbus County",
    countyKey: "columbus-nc",
    headline: "New manufactured homes on land in Tabor City, NC",
    intro: "In Tabor City — the Yam Capital of the World, home to the NC Yam Festival every October since 1946 — Home Placer puts a brand-new home and the land it sits on together as one package, one price, one closing.",
    paragraphs: ["Tabor City sits in inland Columbus County, well off the coast, which means homes here carry a standard Zone I wind rating instead of the tougher beach-county requirements. That can keep your build costs down compared to packages closer to the shore — and we pass that savings straight through to you. Home Placer handles the whole job: finding or using your land, permits, delivery, a permanent foundation, and getting your water and power hooked up. You get a new Clayton, Cavco, or Champion home set on land that's truly yours, with no HOA on our land-home packages.", "Almost all of Columbus County is USDA $0-down eligible, and Tabor City is no exception — so for a lot of buyers here, owning land and a new home can mean little or nothing down. We work with FHA, VA, USDA, and conventional financing, and we'll walk you through which fits your situation in plain English. Packages start in the low $200s. No runaround, no surprise add-ons — just a straight answer from folks who'll tell you the truth about what it takes to get you home."],
    highlights: ["One price, one closing", "USDA $0-down eligible area", "No HOA on your land"],
  },
  {
    slug: "lake-waccamaw",
    name: "Lake Waccamaw",
    county: "Columbus County",
    countyKey: "columbus-nc",
    headline: "New manufactured homes on land in Lake Waccamaw, NC",
    intro: "Lake Waccamaw sits on the shore of the largest Carolina bay lake in the world — home to fish found nowhere else on Earth. Home Placer puts a brand-new home on land right here, as one package, one price, one closing.",
    paragraphs: ["Living near the lake means slower mornings, real water out your door, and room to breathe in Columbus County. We handle the whole thing for you: finding and preparing the land, the permits, delivery, a permanent foundation, and getting your water and power hooked up. You pick a new Clayton, Cavco, or Champion home, and we set it down on land that's yours — no HOA on our land-home packages. Packages start in the low $200s.", "Because Lake Waccamaw is inland, homes here carry a standard (non-coastal) Zone I wind rating, which can keep your build cost down compared to the beach counties an hour east. And almost all of Columbus County is USDA $0-down eligible, so financing here may not require a down payment at all. We also work with FHA, VA, and conventional loans, and we'll talk you through which one actually fits your situation — plain and honest, like a neighbor would."],
    highlights: ["Land + new home, one closing", "USDA $0-down eligible area", "Inland Zone I — lower build cost"],
  },
  {
    slug: "chadbourn",
    name: "Chadbourn",
    county: "Columbus County",
    countyKey: "columbus-nc",
    headline: "New Manufactured Homes on Land in Chadbourn, NC",
    intro: "In the heart of strawberry country, Home Placer pairs a brand-new home with a piece of Chadbourn land — one package, one price, one closing. We handle the land, the permits, the foundation, and the hookups so you can settle in and stay a while.",
    paragraphs: ["Chadbourn has grown strawberries for well over a century, and folks here still gather every spring for the NC Strawberry Festival down Main Street. It's the kind of small Columbus County town where land is still within reach — and that's exactly where Home Placer goes to work. We place a new Clayton, Cavco, or Champion home on a lot near town, set it on a permanent foundation, and run the utilities, so what you get is a real home on real land, not a rental space in someone else's park. No HOA on our land-home packages, with pricing that starts in the low $200s.", "Because Chadbourn sits inland — Columbus County is HUD Wind Zone I, the standard non-coastal rating — your home doesn't carry the heavier wind-build costs you'd see down in the beach counties, which helps keep the package price honest. And nearly all of this county, Chadbourn included, falls inside USDA's $0-down eligible map, so a lot of buyers here can finance with no money down. We also work with FHA, VA, and conventional loans, and we'll walk you through which one actually fits your situation. No pressure, no fine print — just a straight answer from a local who does this every day."],
    highlights: ["USDA $0-down eligible", "One price, one closing", "Packages from the low $200s"],
  },
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

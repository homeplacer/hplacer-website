// The 4 Cavco models extracted via the browser (www.cavcohomes.com +
// cavcohomecenters.com are JS-rendered, so they were captured manually rather
// than by the WebFetch workflow). Written in the same shape as the workflow
// output so scripts/build-models.mjs can merge them.
import fs from "node:fs";

const cdn = "https://cdn2.cavco.com/public/phhweb/gallery/file/";
const PEG = cdn + "259E2BDF041242759CC685D7DAF1F403/";
const AXIS = cdn + "8B40CC653B4C4340BBA18BB5F6F5DECA/";
const seb = (n) => `https://d132mt2yijm03y.cloudfront.net/manufacturer/2035/floorplan/235843/${n}_thumb_xxl.jpg`;
const ree = (n) => `https://d132mt2yijm03y.cloudfront.net/manufacturer/2693/floorplan/235517/${n}_thumb_xxl.jpg`;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const models = [
  {
    sourceUrl: "https://www.cavcohomes.com/our-homes/fleetwoodhomes/standard/us/556-pegasus-28483h",
    brand: "Cavco",
    series: "Pegasus (Rocky Mount)",
    modelName: "Pegasus",
    modelCode: "28483H",
    widthFt: 28,
    lengthFt: 48,
    computedSqft: 28 * 48,
    statedSqft: 1280,
    beds: 3,
    baths: 2,
    decorOptions: ["Front porch"],
    description:
      "Fleetwood Rocky Mount's Pegasus is a value-priced double-wide with strong standard features — LED recessed lighting throughout, 42-inch kitchen overhead cabinets, and porcelain bath sinks. Shown with a front porch.",
    imageUrls: [
      // front elevation first — this is the actual house exterior
      PEG + "27pe28483h_bf0_1733870349679_630_10.jpeg",
      PEG + "pegasus_54269957500_o_1737389977246_724_10.jpg",
      PEG + "pegasus_54268653512_o_1737389914814_724_10.jpg",
      PEG + "pegasus_54269957320_o_1737389836179_724_10.jpg",
      PEG + "pegasus_54268653387_o_1737389923178_724_10.jpg",
      PEG + "pegasus_54269537716_o_1737389887532_724_10.jpg",
      PEG + "pegasus_54269957425_o_1737389830915_724_10.jpg",
      PEG + "pegasus_54269957355_o_1737389833296_724_10.jpg",
      PEG + "pegasus_54269957685_o_1737389963033_724_10.jpg",
      PEG + "pegasus_54268653847_o_1737389900338_724_10.jpg",
      PEG + "pegasus_54268653297_o_1737389937996_724_10.jpg",
      PEG + "pegasus_54269778953_o_1737389850548_724_10.jpg",
      PEG + "pegasus_54269781899_o_1737389839743_724_10.jpg",
    ],
    extractionOk: true,
  },
  {
    sourceUrl: "https://www.cavcohomes.com/our-homes/fleetwoodhomes/standard/us/556-axis-32563n",
    brand: "Cavco",
    series: "Axis (Rocky Mount)",
    modelName: "Axis",
    modelCode: "32563N",
    widthFt: 32,
    lengthFt: 56,
    computedSqft: 32 * 56,
    statedSqft: 1680,
    beds: 3,
    baths: 2,
    decorOptions: [],
    description:
      "Part of Fleetwood Rocky Mount's upgraded Ovation line, the Axis blends on-trend contemporary design with superior functionality and elevated standard features — a beautiful double-wide without the high price.",
    imageUrls: [
      AXIS + "26_c_270_ovation_axis_ap3263n_exterior_001_web_1769725768725_724_10.jpg",
      AXIS + "26_c_270_ovation_axis_ap3263n_exterior_002_web_1769725764566_724_10.jpg",
      AXIS + "26_c_270_ovation_axis_ap3263n_exterior_003_web_1769725758553_724_10.jpg",
      AXIS + "scrubbed_26_c_270_ovation_axis_ap3263n_kitchen_001_1771971643452_723_10.jpg",
      AXIS + "scrubbed_26_c_270_ovation_axis_ap3263n_kitchen_002_1771971638507_723_10.jpg",
      AXIS + "scrubbed_26_c_270_ovation_axis_ap3263n_livingroom_001_1771971626528_723_10.jpg",
      AXIS + "scrubbed_26_c_270_ovation_axis_ap3263n_livingroom_002_1771971622690_723_10.jpg",
      AXIS + "scrubbed_26_c_270_ovation_axis_ap3263n_porch_001_1771971613435_723_10.jpg",
      AXIS + "26_c_270_ovation_axis_ap3263n_bed_001_web_1769725787256_727_10.jpg",
      AXIS + "26_c_270_ovation_axis_ap3263n_bath_001_web_1769725818398_724_10.jpg",
    ],
    extractionOk: true,
  },
  {
    sourceUrl: "https://www.cavcohomecenters.com/plan/235843-3974/cavco-home-center-of-tifton/tifton/the-summit/sebastian-32644d/",
    brand: "Cavco",
    series: "The Summit (Cavco Douglas)",
    modelName: "Sebastian",
    modelCode: "32644D",
    widthFt: 32,
    lengthFt: 64,
    computedSqft: 32 * 64,
    statedSqft: 1920,
    beds: 4,
    baths: 2,
    decorOptions: [],
    description:
      "The Sebastian by Cavco Douglas is a spacious 4-bedroom, 2-bath ranch-style double-wide in The Summit series, offering well-designed living space across two sections.",
    imageUrls: range(1, 15).map(seb),
    extractionOk: true,
  },
  {
    sourceUrl: "https://www.cavcohomecenters.com/plan/235517-5559/cavco-home-center-of-lafayette/lafayette/lifestyle/reece-32663a/",
    brand: "Cavco",
    series: "Lifestyle (Cavco Moultrie)",
    modelName: "Reece",
    modelCode: "LY32663A",
    widthFt: 32,
    lengthFt: 66,
    computedSqft: 32 * 66,
    statedSqft: 1958,
    beds: 3,
    baths: 2,
    decorOptions: [],
    description:
      "The Reece by Cavco Moultrie is a 3-bedroom, 2-bath ranch-style double-wide in the Lifestyle series, with a generous two-section layout.",
    imageUrls: range(1, 18).map(ree),
    extractionOk: true,
  },
];

fs.writeFileSync("data/_cavco-extra.json", JSON.stringify({ models }, null, 2));
console.log(`wrote data/_cavco-extra.json — ${models.length} Cavco models`);

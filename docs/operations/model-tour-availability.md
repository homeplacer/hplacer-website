# Model-tour availability repair — October 6, 2026

This is a frontend catalog projection, not an ingestion or availability service.
`getAvailableModelTourUrl` in `src/lib/model-tour-availability.ts` withholds only
two confirmed unavailable Matterport IDs for their exact catalog slugs. The
source records retain those authentic links. All public model consumers use the
projected `Home.tourUrl`, including model detail pages and recently placed-home
cross-links. The current catalog has no tour badge or tour filter.

## Verified Tradition 68 replacement

- Catalog: `tradition-68`, exact manufacturer code `34TRA28684BH`, 28 × 68,
  four bedrooms, two bathrooms.
- [Manufacturer identity and floor plan](https://myappalachiahome.com/models/34tra28684bh/)
  match the checked-in model code and floor plan. The manufacturer still embeds
  the unavailable original tour `aa2GGU46jcX`.
- [Common Sense Housing's exact-model page](https://www.commonsensehousing.com/plan/223742/tradition/2868b-34tra28684bh/)
  names `2868B 34TRA28684BH`, four bedrooms, two bathrooms and 28 × 68, and
  embeds the replacement [Matterport tour `sFnvNkUWzgV`](https://my.matterport.com/show/?m=sFnvNkUWzgV).
- [Matterport's public player metadata](https://my.matterport.com/api/v1/player/models/sFnvNkUWzgV/)
  returned HTTP 200, `status: viewable`, `is_public: true`, and the name
  “Tradition 2868B by Clayton Homes Appalachia.” The showcase returned HTTP 200.

Only this tour URL changes in `data/models.json`. The existing nominal catalog
square-footage convention, pricing, photos, floor plans and specifications do
not change. A tour can depict factory/dealer options; it is not a price or
current-stock promise.

## Unavailable Dutch tours

| Catalog slug | Preserved Matterport ID | Primary manufacturer page |
| --- | --- | --- |
| `dutch-elite-1676-01` | `4YJzwgZWJMZ` | [Dutch Elite 1676-01](https://www.championhomesofnc.com/home-plans-photos/dutch-elite-1676-01) |
| `dutch-elite-1676-07` | `Hdjs5Whevk7` | [Dutch Elite 1676-07](https://www.championhomesofnc.com/home-plans-photos/dutch-elite-1676-07) |

Both manufacturer pages still embed those original IDs. Direct showcase checks
returned HTTP 404 with Matterport's `model` / `not.found` error. No replacement
is published without exact-model evidence. A geometry-matched Dutch 1676-07
dealer alias remains a research candidate, not a confirmed numeric-code
replacement.

The projected catalog omits these two `tourUrl` values, so there is no broken
anchor, start button, iframe, empty tour section or recently placed-home `#tour`
CTA. Their thirteen original photos, specs and pricing remain available
normally. Neither Dutch record currently has a `floorPlans` attachment, so no
floor-plan control is invented. Other models' recorded floor plans are retained.

## Safe restoration

1. Verify the exact numeric model/floor-plan identity through the manufacturer
   or dealer, and check that the proposed public showcase actually loads.
2. A reviewed replacement URL in the source record automatically passes the
   source-specific exception; the whole model is not permanently blocked.
3. If an original ID itself becomes available again, verify that same tour and
   remove its explicit exception in a reviewed frontend PR.
4. Run `tests/model-tour-availability.test.mjs` plus the catalog/gallery tests.
   Review the model and placed-home journeys before deployment.

No runtime network check, new model schema, backend/API/event change, or
deployment is introduced by this repair.

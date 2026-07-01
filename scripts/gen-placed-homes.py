#!/usr/bin/env python3
"""Generate data/placed-homes.json — one record per placed home (the 66 with
photos), joined to its manufacturer MODEL (from the placements sheet) and its
full photo GALLERY. Re-run after updating sold-homes/placements/galleries/models.
Lot size (lotAcres) is left null until Joe re-exports Paragon with the Acres column;
drop a {address|mls -> acres} map into LOT_ACRES below (or a CSV) and re-run."""
import json, os, re, difflib

ROOT = "/Users/spencer/projects/hplacer"
D = os.path.join(ROOT, "data")
sold = json.load(open(f"{D}/sold-homes.json"))
placements = json.load(open(f"{D}/placements.json"))
galleries = json.load(open(f"{D}/galleries.json"))
models = json.load(open(f"{D}/models.json"))

import csv
from datetime import datetime
# Paragon re-export (sold listings) → lot acres + heated sqft by MLS#
_acsv = {r["MLS #"].strip(): r for r in csv.DictReader(open(f"{D}/paragon-sold.csv", encoding="utf-8-sig")) if r.get("MLS #", "").strip()}
def _acres(mls):
    v = (_acsv.get(mls, {}).get("Number of Acres") or "").strip()
    try:
        return round(float(v), 2) if v else None
    except ValueError:
        return None
def _heated(mls):
    v = (_acsv.get(mls, {}).get("Total Heated Sq Ft") or "").strip().replace(",", "")
    try:
        return int(float(v)) if v else None
    except ValueError:
        return None
def _close(mls):
    v = (_acsv.get(mls, {}).get("Closing Date") or "").strip()
    if not v:
        return None
    try:
        return datetime.strptime(v, "%m/%d/%Y").date().isoformat()  # YYYY-MM-DD, sortable
    except ValueError:
        return None

# ---- normalization helpers ----
SUFFIX = {"rd": "road", "dr": "drive", "ln": "lane", "st": "street", "ave": "avenue",
          "ct": "court", "cir": "circle", "hwy": "highway", "blvd": "boulevard",
          "pl": "place", "pkwy": "parkway", "trl": "trail", "ter": "terrace"}

def norm_addr(a: str) -> str:
    a = a.lower().replace(".", " ")
    a = re.sub(r"[^a-z0-9 ]", " ", a)
    toks = [SUFFIX.get(t, t) for t in a.split()]
    return " ".join(toks).strip()

def addr_key(a: str) -> str:
    """Loose key: house number + first significant street word."""
    toks = norm_addr(a).split()
    num = toks[0] if toks and toks[0].isdigit() else ""
    street = next((t for t in toks[1:] if t not in ("n", "s", "e", "w", "north", "south", "east", "west")), "")
    return f"{num} {street}".strip()

def norm_model(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())

def slugify(a: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", a.lower()).strip("-")
    return s

# ---- placements: address -> model name (both exact + loose key) ----
plc_exact, plc_loose = {}, {}
for p in placements:
    m = (p.get("model") or "").strip()
    if not m:
        continue
    plc_exact[norm_addr(p["address"])] = m
    plc_loose.setdefault(addr_key(p["address"]), m)

# ---- model index: normalized name/aka -> slug ----
model_key = {}
for mo in models:
    for k in [mo["name"]] + (mo.get("aka") or []):
        model_key.setdefault(norm_model(k), mo["slug"])
model_norms = list(model_key.keys())
model_by_slug = {mo["slug"]: mo for mo in models}

# Manual aliases for messy/merged placement names (norm -> slug)
ALIAS = {
    "ultrapro60": "ultra-flex-28-68", "ultra60": "ultra-flex-28-68", "ultra68": "ultra-flex-28-68",
    "tradition": "tradition-68", "traditionapp": "tradition-68",
    "ironclad": "ironclad-2856", "dutchelite": "dutch-elite-3258-03",
}
NO_MODEL = {"farmhouse72", "pearl", "brunswick", "sapphire", "lewis", "imagine",
            "browneyed", "orginalhouse", "legended68"}  # genuinely not in the 82-model catalog

# Joe's manual corrections (2026-06-27), keyed by exact address.
# value = (modelSlug | None, displayName). None slug = show the name, no floor plan.
OVERRIDE = {
    "2008 Pint Circle": ("pinehurst", "Pinehurst"),
    "218 Eva Dr.": ("ultra-flex-28-68", "Ultra Pro 28×68"),
    "133 Melanie Brooke Ln.": ("ultra-flex-28-52", "52 Breeze"),
    "122 Forman Way": ("ultra-flex-28-52", "52 Breeze"),
    "3820 Wayside Rd.": ("shout", "Shout"),  # Joe: 3820 is a Shout (MLS listed it 4/2 1680)
    "2725 Orion Dr.": ("stayin-alive", "Staying Alive"),
    "8735 W Highway 19": ("stayin-alive", "Staying Alive"),
    "128 Forman Way": ("brown-eyed-girl", "Brown Eyed Girl"),  # Tempo line, now in catalog
    "1305 Rabbit Ln.": (None, "Lewis"),          # discontinued (Clayton Giles) — name only
    "487 N Green Sea Rd.": ("intuition", "Intuition"),  # Miyo "Intuition" (Joe's "institute"), already in catalog
    "491 N Green Sea Rd.": ("tradition-48f", "Tradition 48F"),  # Appalachia line, now in catalog
}

def match_model(name: str):
    k = norm_model(name)
    if not k or k in NO_MODEL:
        return None
    if k in ALIAS:
        return ALIAS[k]
    if k in model_key:
        return model_key[k]
    c = difflib.get_close_matches(k, model_norms, n=1, cutoff=0.8)
    if c:
        return model_key[c[0]]
    for mk, slug in model_key.items():            # prefix (pegas -> pegasus)
        if len(k) >= 5 and (mk.startswith(k) or k.startswith(mk)):
            return slug
    return None

# ---- build records ----
out, seen_slugs, report = [], {}, []
matched = joined = 0
for town in sold["towns"]:
    for h in town["homes"]:
        mls = str(h["mls"])
        addr = h["address"]
        model_name = plc_exact.get(norm_addr(addr)) or plc_loose.get(addr_key(addr))
        if model_name:
            joined += 1
        model_slug = match_model(model_name) if model_name else None
        # Guard: a Double Wide must never resolve to a single-wide (<24ft) plan
        if model_slug and "double" in (h.get("style") or "").lower():
            mw = model_by_slug.get(model_slug, {}).get("widthFt") or 0
            if mw and mw < 24:
                model_slug = None
        # Guard: reject an auto-match whose bedroom count differs from the home
        if model_slug and model_by_slug.get(model_slug, {}).get("beds") not in (None, h["beds"]):
            model_slug = None
        if addr in OVERRIDE:                       # Joe's explicit corrections win
            model_slug, model_name = OVERRIDE[addr]
        if model_slug:
            matched += 1
        slug = slugify(addr)
        if slug in seen_slugs:                      # disambiguate any collision with mls
            slug = f"{slug}-{mls}"
        seen_slugs[slug] = True
        lot = _acres(mls)
        out.append({
            "slug": slug, "mls": mls, "address": addr,
            "town": town["name"], "townSlug": town["slug"],
            "beds": h["beds"], "baths": h["baths"], "style": h["style"],
            "withLand": h["withLand"], "price": h["price"],
            "lat": h.get("lat"), "lon": h.get("lon"),
            "photo": h["photo"], "photos": galleries.get(mls, []),
            "modelName": model_name, "modelSlug": model_slug,
            "lotAcres": lot, "sqftHeated": _heated(mls), "closeDate": _close(mls),
        })
        report.append((addr, model_name or "—", model_slug or ("(no catalog match)" if model_name else "(no model in sheet)")))

json.dump(out, open(f"{D}/placed-homes.json", "w"), indent=1)

print(f"placed homes: {len(out)}")
print(f"joined to a model name (from sheet): {joined}/{len(out)}")
print(f"matched to a catalog model (floor plan/tour): {matched}/{len(out)}")
print(f"lot acres populated: {sum(1 for r in out if r['lotAcres'] is not None)}/{len(out)}")
print(f"heated sqft populated: {sum(1 for r in out if r['sqftHeated'] is not None)}/{len(out)}")
print(f"total gallery photos referenced: {sum(len(r['photos']) for r in out)}")
print("\n--- per-home model match ---")
for addr, mn, ms in report:
    flag = "  " if ms.startswith("/") or (ms and not ms.startswith("(")) else "??"
    print(f"  {flag} {addr:28} {mn:18} -> {ms}")

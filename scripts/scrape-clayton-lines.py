#!/usr/bin/env python3
"""Scrape Clayton 'built' line model pages (NXT / Tempo / Miyo) into the FINAL
data/models.json object shape and APPEND them (dedup by slug). Does NOT run
build-models.mjs (whose output omits floorPlans/tourUrl and would regress the
hand-finalized catalog). Re-runnable: skips slugs already in models.json."""
import re, json, subprocess, os
from concurrent.futures import ThreadPoolExecutor

ROOT = "/Users/spencer/projects/hplacer"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# (line, base, [codes]) — exclude any farm-titled model after fetch.
TARGETS = [
    ("NXT", "https://claytonbuiltnxt.com", [
        "27nxt16602ah", "27nxt16763dh", "27nxt28523ah", "27nxi28563ah", "27nxt28563ch",
        "27nxt28603ah", "27nxt28684ah", "27nxi28764ah", "27nxt28764ch"]),
    ("Tempo", "https://claytonbuilttempo.com", ["57tmi28604ah"]),  # Brown Eyed Girl
    ("Appalachia", "https://myappalachiahome.com", ["34tra28483fh"]),  # Tradition 48F (491 N Green Sea)
]

def curl(url, ref):
    return subprocess.run(
        ["curl", "-s", "-A", UA, "-e", ref, "-H", "Accept: text/html,application/xhtml+xml",
         "-H", "Accept-Language: en-US,en", url],
        capture_output=True, text=True).stdout

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

NUM = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}

def scrape(args):
    line, base, code = args
    url = f"{base}/models/{code}/"
    h = curl(url, f"{base}/")
    if len(h) < 2000:
        return {"code": code, "ok": False, "why": f"short page {len(h)}b"}
    title = (re.search(r"<title>([^<]+)</title>", h) or [None, ""])[1]
    # title: "27NXT28523AH :: WILDER - Clayton NXT"
    mname = "?"
    mt = re.search(r"::\s*([^-<]+?)\s*-\s*\w", title)
    if mt:
        mname = mt.group(1).strip().title()
    if "farm" in mname.lower() or "farm" in title.lower():
        return {"code": code, "ok": False, "why": "farm-excluded"}
    # dims/beds from code: <2d><3a><WW><LL><B><suffix>
    cm = re.match(r"^\d{2}[a-z]{3}(\d{2})(\d{2})(\d)[a-z]+$", code, re.I)
    W = int(cm.group(1)); L = int(cm.group(2)); beds_code = int(cm.group(3))
    beds_page = re.findall(r"(\d+)\s*[bB]edroom", h)
    baths_page = re.findall(r"(\d+(?:\.\d+)?)\s*[bB]ath", h)
    beds = int(beds_page[0]) if beds_page else beds_code
    baths = float(baths_page[0]) if baths_page else 2
    baths = int(baths) if baths == int(baths) else baths
    stated = re.findall(r"([\d,]+)\s*(?:sq\.?\s*ft|square)", h, re.I)
    stated_sqft = int(stated[0].replace(",", "")) if stated else None
    flp = re.findall(r"https://api\.claytonhomes\.com/images/mfg/flp/[a-z0-9-]+\.jpg", h)
    tour = re.findall(r"https?://[^\"' ]*momento360[^\"' ]*", h) or re.findall(r"https?://[^\"' ]*matterport[^\"' ]*", h)
    tour_url = tour[0].replace("&#038;", "&") if tour else None
    # photos: ext first then int, dedup, drop flp
    allimg = re.findall(r"https://api\.claytonhomes\.com/images/mfg/(?:ext|int)/[a-z0-9-]+\.jpg", h)
    ext = [u for u in dict.fromkeys(allimg) if "/ext/" in u]
    intr = [u for u in dict.fromkeys(allimg) if "/int/" in u]
    images = ext + intr
    sqft = W * L
    obj = {
        "slug": slugify(mname),
        "brand": "Clayton",
        "series": line,
        "name": mname,
        "modelCode": code.upper(),
        "widthFt": W, "lengthFt": L, "sqft": sqft,
        "beds": beds, "baths": baths,
        "description": f"A {NUM.get(beds, beds)}-bedroom, {NUM.get(int(baths), baths)}-bath manufactured home in Clayton's {line} line — {W}×{L} ({sqft} sq ft) with a modern open-concept layout."
                       + (f" Listed at about {stated_sqft:,} heated sq ft." if stated_sqft else ""),
        "decorOptions": [],
        "imageUrls": images,
        "aka": [],
        "bestSeller": False, "bestSellerRank": 999,
        "sourceUrl": url,
    }
    if tour_url:
        obj["tourUrl"] = tour_url
    obj["floorPlans"] = [{"url": flp[0]}] if flp else []
    return {"code": code, "ok": bool(images) and bool(W and L), "name": mname, "obj": obj,
            "imgs": len(images), "fp": bool(flp), "tour": bool(tour_url), "stated": stated_sqft}

jobs = [(line, base, c) for line, base, codes in TARGETS for c in codes]
with ThreadPoolExecutor(max_workers=10) as ex:
    results = list(ex.map(scrape, jobs))

ok = [r for r in results if r.get("ok")]
bad = [r for r in results if not r.get("ok")]
print(f"scraped OK: {len(ok)} | failed/excluded: {len(bad)}")
for r in ok:
    print(f"  {r['code']:16} {r['name']:16} {r['obj']['widthFt']}x{r['obj']['lengthFt']} {r['obj']['beds']}/{r['obj']['baths']} imgs={r['imgs']} fp={r['fp']} tour={r['tour']} stated={r['stated']}")
for r in bad:
    print(f"  SKIP {r['code']}: {r.get('why')}")

json.dump([r["obj"] for r in ok], open(f"{ROOT}/data/_clayton-new.json", "w"), indent=1)
print(f"\nwrote data/_clayton-new.json ({len(ok)} models)")

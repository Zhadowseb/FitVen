"""Scraper for SATS-centre i Danmark (sats.dk/traeningscenter).

Koer:  python scrape_sats.py        -> opdaterer alle centre i denne mappe
       python scrape_sats.py 3      -> kun de foerste 3 (test)

Hero-billedet komprimeres til maks 1200 px bredde, JPEG kvalitet 75 (kraever Pillow).
"""
import re, html, json, os, sys, io, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor

BASE = "https://www.sats.dk"
OUT = os.path.dirname(os.path.abspath(__file__))
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FitVen-scraper"}
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else None
MAXW, QUALITY = 1200, 75


def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=60) as r:
                data = r.read()
                return data if binary else data.decode("utf-8", "replace")
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2)


def state_json(page):
    m = re.search(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', page, re.S)
    return json.loads(html.unescape(m.group(1))) if m else {}


def rich_text(node):
    """Contentful rich text -> plain text."""
    if node is None:
        return ""
    if isinstance(node, dict):
        if node.get("nodeType") == "text":
            return node.get("value", "")
        inner = "".join(rich_text(c) for c in node.get("content", []))
        if node.get("nodeType") in ("paragraph", "heading-1", "heading-2", "heading-3", "list-item"):
            inner += "\n"
        return inner
    if isinstance(node, list):
        return "".join(rich_text(c) for c in node)
    return ""


def clean(s):
    s = (s or "").replace("\xa0", " ").replace("–", "-")
    return re.sub(r"\n\s*\n+", "\n", s).strip()


def safe_name(s):
    s = re.sub(r'[<>:"/\\|?*]', "-", s)
    return re.sub(r"\s+", " ", s).strip(" .")


def names(section):
    """Facilities/services: fullList is empty when there are few items; fall back to the featured lists."""
    items = section.get("fullList") or (section.get("featuredLeft", []) + section.get("featuredRight", []))
    return [x["name"] for x in items if x.get("name")]


def encode_url(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, urllib.parse.quote(p.path), p.query, p.fragment))


def compress(raw):
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return raw, None
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    if im.width > MAXW:
        im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return (buf.getvalue(), ".jpg") if len(buf.getvalue()) < len(raw) else (raw, None)


# ---------- listing ----------
listing = state_json(get(BASE + "/traeningscenter"))
clubs = listing.get("clubs", [])
print("clubs:", len(clubs))


def process(c):
    url = BASE + c["link"]["href"]
    page = get(url)
    j = state_json(page)
    ld = {}
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', page, re.S)
    if m:
        try:
            ld = json.loads(m.group(1))
        except Exception as e:
            print("ld+json fail", url, e)
    a = ld.get("address", {})
    street = a.get("streetAddress") or c["address"]["streetAddress"]
    postal = a.get("postalCode")
    city = a.get("addressLocality")
    if not (postal and city):
        parts = c["address"]["area"].split(" ", 1)
        postal, city = parts[0], parts[1] if len(parts) > 1 else ""
    address = f"{street}, {postal} {city}"
    folder = os.path.join(OUT, safe_name(address))
    os.makedirs(folder, exist_ok=True)

    ph = j.get("pageHeader", {})
    pv = j.get("planYourNextVisit", {})
    oh = pv.get("openingHours", {}).get("data", {})
    regular = []
    for fac in oh.get("regular", {}).get("facilities", []):
        for tf in fac.get("timeFrames", []):
            for d in tf.get("days", []):
                regular.append({"days": clean(d.get("label")),
                                "open": clean(", ".join(s.get("value", "") for s in d.get("statuses", [])))})
    special = []
    for e in oh.get("irregular", {}).get("entries", []):
        for v in e.get("value", []):
            special.append({"date": e.get("key"), "title": v.get("title"),
                            "open": clean(", ".join(s.get("value", "") for f in v.get("facilities", []) for s in f.get("statuses", [])))})
    memberships = []
    for view in j.get("becomeMemberSection", {}).get("views", []):
        for seg in view.get("segments", []):
            for mem in seg.get("memberships", []):
                memberships.append({"age_group": view.get("id"), "member_type": seg.get("label"),
                                    "name": mem.get("name"), "price": mem.get("price"), "unit": mem.get("unit"),
                                    "description": mem.get("description"), "benefits": mem.get("benefits")})
    faqs = [{"question": clean(q.get("name")), "answer": clean(q.get("acceptedAnswer", {}).get("text"))}
            for f in j.get("faqs", []) for q in f.get("mainEntities", [])]
    md = re.search(r'<meta name="description" content="([^"]*)"', page)
    regions = [k.replace("region-", "") for k, v in c.get("filters", {}).items() if k.startswith("region-") and v and k != "region-all-regions"]
    hero_url = (ph.get("image") or {}).get("src") or ld.get("image") or c["image"]["src"]

    info = {
        "chain": "SATS",
        "name": ph.get("title") or ld.get("name") or c["name"],
        "short_name": c["name"],
        "sats_id": c["id"],
        "region": regions[0] if regions else None,
        "address": {"street": street, "postal_code": postal, "city": city, "country": "DK", "full": address},
        "location": {"latitude": c["location"]["lat"], "longitude": c["location"]["lng"]},
        "url": url,
        "membership_url": BASE + "/bliv-medlem-sats",
        "opening_hours": regular,
        "opening_hours_schema": ld.get("openingHours"),
        "special_days": special,
        "meta_description": html.unescape(md.group(1)) if md else None,
        "description": clean(rich_text(ph.get("richText", {}).get("content"))),
        "parking": clean(rich_text(pv.get("parking", {}).get("body", {}).get("content"))) or None,
        "facilities": names(j.get("facilities", {})) or [o.get("itemOffered", {}).get("name") for o in ld.get("hasOfferCatalog", {}).get("itemListElement", [])],
        "services": names(j.get("services", {})),
        "filters": sorted(k for k, v in c.get("filters", {}).items() if v),
        "memberships": memberships,
        "faq": faqs,
        "nearby": [{"name": n.get("title"), "url": BASE + n.get("href", ""), "distance": ", ".join(n.get("texts", []))}
                   for n in j.get("nearby", [])],
        "images": {"hero": hero_url, "teaser": c["image"]["src"],
                   "gallery": [mm["image"]["src"] for mm in j.get("imageGallery", {}).get("media", []) if mm.get("image")]},
        "hero_image_file": None,
        "scraped_at": time.strftime("%Y-%m-%d"),
    }
    try:
        raw = get(encode_url(hero_url), binary=True)
        data, ext = compress(raw)
        if ext is None:
            ext = os.path.splitext(hero_url.split("?")[0])[1].lower() or ".jpg"
        fn = "hero" + ext
        for old in os.listdir(folder):
            if old.startswith("hero"):
                os.remove(os.path.join(folder, old))
        with open(os.path.join(folder, fn), "wb") as f:
            f.write(data)
        info["hero_image_file"] = fn
    except Exception as e:
        print("FAIL image", url, e)
    with open(os.path.join(folder, "info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    fold = os.path.basename(folder)
    return {"name": info["name"], "address": address, "folder": fold, "url": url,
            "latitude": info["location"]["latitude"], "longitude": info["location"]["longitude"],
            "sats_id": c["id"], "region": info["region"], "facilities": info["facilities"],
            "info_file": fold + "/info.json",
            "hero_image": fold + "/" + info["hero_image_file"] if info["hero_image_file"] else None}


todo = clubs[:LIMIT] if LIMIT else clubs
with ThreadPoolExecutor(6) as ex:
    results = list(ex.map(process, todo))
results.sort(key=lambda r: r["address"])
if not LIMIT:
    with open(os.path.join(OUT, "alle-centre.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
print("done", len(results))
for r in results:
    print(r["folder"], "|", r["hero_image"])

"""Scraper for Fit&Sund-huse (fitogsund.dk/p/huse).

Koer:  python scrape_fitsund.py        -> opdaterer alle huse i denne mappe
       python scrape_fitsund.py 3      -> kun de foerste 3 (test)

fitogsund.dk har hverken koordinater eller centerbilleder paa siderne. Koordinater slaas op
via DAWA (Danmarks Adressers Web API, api.dataforsyningen.dk) ud fra adressen. Hvis et hus har et
eget billede paa siden bruges det, ellers gemmes kaedens logo som fallback i mappens rod.
"""
import re, html, json, os, sys, io, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor

BASE = "https://fitogsund.dk"
OUT = os.path.dirname(os.path.abspath(__file__))
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FitVen-scraper"}
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else None
MAXW, QUALITY = 1200, 75
DAWA = "https://api.dataforsyningen.dk/adgangsadresser"


def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=90) as r:
                data = r.read()
                return data if binary else data.decode("utf-8", "replace")
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2)


def text(fragment):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", fragment, flags=re.S)
    t = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>|</div>", "\n", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t).replace("\xa0", " ").replace("–", "-")
    t = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in t.split("\n"))
    return re.sub(r"\n\s*\n+", "\n", t).strip()


def safe_name(s):
    s = re.sub(r'[<>:"/\\|?*]', "-", s)
    return re.sub(r"\s+", " ", s).strip(" .")


def absolute(u):
    u = html.unescape(u)
    if u.startswith("http"):
        return u
    return BASE + "/" + u.lstrip("/")


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


def geocode(address):
    """DAWA fuzzy lookup -> (lat, lng, matched address, exact?)"""
    q = urllib.parse.urlencode({"q": address, "fuzzy": "", "struktur": "mini", "per_side": 8})
    try:
        res = json.loads(get(f"{DAWA}?{q}"))
    except Exception as e:
        print("FAIL geocode", address, e)
        return None
    if not res:
        return None
    norm = lambda s: re.sub(r"[\s,]+", " ", s.lower().replace("allé", "alle").replace("é", "e")).strip()
    street_name = norm(re.sub(r"\s+\d.*$", "", address.split(",")[0]))
    # prefer a hit on the same street name; DAWA's fuzzy ranking sometimes puts another street first
    a = next((r for r in res if norm(r.get("vejnavn", "")) == street_name), None)
    if a is None:
        # deterministic fallback: list the whole street in that postal code and pick the matching house number
        pc = re.search(r"\b(\d{4})\b", address.split(",")[-1])
        num = re.search(r"\d+", address.split(",")[0][len(street_name):] or address.split(",")[0])
        if pc:
            q2 = urllib.parse.urlencode({"vejnavn": address.split(",")[0].rsplit(" ", 1)[0], "postnr": pc.group(1), "struktur": "mini", "per_side": 500})
            try:
                street = json.loads(get(f"{DAWA}?{q2}"))
            except Exception:
                street = []
            if street:
                a = next((r for r in street if num and r.get("husnr", "").startswith(num.group(0))), street[0])
        if a is None:
            a = res[0]
    return {"latitude": a.get("y"), "longitude": a.get("x"), "matched_address": a.get("betegnelse"),
            "exact": norm(a.get("betegnelse", "")) == norm(address), "source": "DAWA"}


def hours_table(page, heading):
    m = re.search(r"<h2>\s*" + heading + r"\s*</h2>\s*<div class=\"hours-table\">(.*?)</div>\s*</div>", page, re.S)
    if not m:
        return []
    rows = [{"day": text(d), "open": " & ".join(x for x in text(t).replace(".", ":").split("\n") if x)}
            for d, t in re.findall(r"<div><span>(.*?)</span><span>(.*?)</span>", m.group(1), re.S)]
    rows = [r for r in rows if r["day"]]
    if len(rows) == 1 and "alle dage" in rows[0]["open"].lower():   # e.g. Nyborg: "Mandag | Alle dage 04 - 00"
        rows[0] = {"day": "Alle dage", "open": re.sub(r"(?i)alle dage\s*", "", rows[0]["open"]).strip()}
    return rows


# ---------- listing ----------
listing = get(BASE + "/p/huse")
cards = re.findall(r'<a href="(/c/huse/[^"]+)" class="house-card">\s*<div class="title">(.*?)</div>\s*<div class="sub">(.*?)</div>', listing, re.S)
houses = [{"url": BASE + href, "slug": href.rsplit("/", 1)[-1], "title": text(t), "street": text(s)} for href, t, s in cards]
print("houses:", len(houses))

# chain logo as fallback image
LOGO = os.path.join(OUT, "fitogsund-logo.png")
if not os.path.exists(LOGO):
    try:
        with open(LOGO, "wb") as f:
            f.write(get(BASE + "/f/design/logo.png", binary=True))
    except Exception as e:
        print("FAIL logo", e)


def process(h):
    page = get(h["url"])
    name = re.search(r'<div class="title" itemprop="name">(.*?)</div>', page, re.S)
    addr = re.search(r'<div class="address" itemprop="address">(.*?)</div>', page, re.S)
    addr_lines = [l for l in text(addr.group(1)).split("\n") if l] if addr else []
    street = addr_lines[0] if addr_lines else h["street"]
    pc, city = ("", "")
    if len(addr_lines) > 1:
        parts = addr_lines[1].split(" ", 1)
        pc, city = parts[0], (parts[1] if len(parts) > 1 else "")
    address = f"{street}, {pc} {city}".strip(", ").strip()
    folder = os.path.join(OUT, safe_name(address))
    os.makedirs(folder, exist_ok=True)

    md = re.search(r'<meta name="description" content="([^"]*)"', page)
    phone = re.search(r'itemprop="telephone">(.*?)</span>', page, re.S)
    email = re.search(r'href="mailto:([^"]+)"', page)
    maps = re.search(r'href="(https://www\.google\.com/maps/[^"]+)"', page)
    schedule = re.search(r'href="(https://fitogsund\.goactivebooking\.com/[^"]+)"[^>]*>\s*Se holdplan', page, re.S)
    facs = re.search(r'<ul class="facilities">(.*?)</ul>', page, re.S)
    facilities = []
    if facs:
        for li in re.findall(r"<li[^>]*>(.*?)</li>", facs.group(1), re.S):
            t = text(li)
            if t and t not in facilities:
                facilities.append(t)
    desc = re.search(r'<div class="article__content" itemprop="description">(.*?)</div>\s*(?:<div class="scroll-to-links">|</section>)', page, re.S)
    leader_name = re.search(r'<div class="house-leader-info">\s*<div class="name">(.*?)</div>\s*<div class="job">(.*?)</div>', page, re.S)
    leader_img = re.search(r'<div class="house-leader">.*?<img src="([^"]+)"', page, re.S)
    services, categories = [], []
    grid = re.search(r'<div class="services-grid-wrap">(.*?)(?:<footer|<div class="price-wrap"|$)', page, re.S)
    if grid:
        filters = [text(x) for x in re.findall(r'data-filter="\.filter-[^"]+"[^>]*>(.*?)</a>', grid.group(1), re.S)]
        categories = [f for f in filters if f and f != "Alle"]
        for href, cls, title in re.findall(r'<a href="([^"]+)" class="item service-card([^"]*)">.*?<div class="title">(.*?)</div>\s*</a>', grid.group(1), re.S):
            lines = [l for l in text(title).split("\n") if l]
            if not lines:
                continue
            entry = {"name": lines[0], "room": lines[1] if len(lines) > 1 else None,
                     "categories": sorted({c.replace("filter-", "").split("--")[0] for c in cls.split() if c.startswith("filter-")}),
                     "url": absolute(href.split("?")[0])}
            if entry["name"] not in [s["name"] for s in services]:
                services.append(entry)
    # a house's own photo (the site rarely has one): any /f/ image that is not design, blog, gallery or placeholder
    own_imgs = [absolute(u) for u in re.findall(r'(?:src|href)="([^"]*\bf/[^"]+\.(?:jpe?g|png|webp)[^"]*)"', page)
                if not re.search(r"design|blog|gallery|no-image|thumb\?src=/f/(design|blog|gallery)", u)]
    hero_url = own_imgs[0] if own_imgs else None

    geo = geocode(address) or {}
    info = {
        "chain": "Fit&Sund",
        "name": f'Fit&Sund {text(name.group(1))}' if name else f'Fit&Sund {h["title"]}',
        "short_name": text(name.group(1)) if name else h["title"],
        "address": {"street": street, "postal_code": pc or None, "city": city or None, "country": "DK", "full": address},
        "location": {"latitude": geo.get("latitude"), "longitude": geo.get("longitude")},
        "geocode": geo or None,
        "url": h["url"],
        "membership_url": BASE + "/p/bliv-medlem",
        "class_schedule_url": schedule.group(1).replace("&amp;", "&") if schedule else None,
        "google_maps_url": maps.group(1).replace("&amp;", "&") if maps else None,
        "phone": text(phone.group(1)) if phone else None,
        "email": email.group(1) if email else None,
        "opening_hours": hours_table(page, "Åbningstider"),
        "reception_hours": hours_table(page, "Reception"),
        "meta_description": html.unescape(md.group(1)) if md else None,
        "description": text(desc.group(1)) if desc else None,
        "facilities": facilities,
        "service_categories": categories,
        "services": services,
        "manager": {"name": text(leader_name.group(1)), "title": text(leader_name.group(2)),
                    "image": absolute(leader_img.group(1)) if leader_img else None} if leader_name else None,
        "images": {"hero": hero_url, "fallback": "../fitogsund-logo.png"},
        "hero_image_file": None,
        "hero_is_placeholder": False,
        "scraped_at": time.strftime("%Y-%m-%d"),
    }
    for old in os.listdir(folder):
        if old.startswith("hero"):
            os.remove(os.path.join(folder, old))
    if hero_url:
        try:
            raw = get(hero_url, binary=True)
            data, ext = compress(raw)
            if ext is None:
                ext = os.path.splitext(hero_url.split("?")[0])[1].lower() or ".jpg"
            fn = "hero" + ext
            with open(os.path.join(folder, fn), "wb") as f:
                f.write(data)
            info["hero_image_file"] = fn
        except Exception as e:
            print("FAIL image", h["url"], e)
    if not info["hero_image_file"] and os.path.exists(LOGO):
        # no photo of the house on fitogsund.dk -> use the chain logo so every folder has an image
        with open(LOGO, "rb") as src, open(os.path.join(folder, "hero.png"), "wb") as dst:
            dst.write(src.read())
        info["hero_image_file"] = "hero.png"
        info["hero_is_placeholder"] = True
    with open(os.path.join(folder, "info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    fold = os.path.basename(folder)
    return {"name": info["name"], "address": address, "folder": fold, "url": h["url"],
            "latitude": info["location"]["latitude"], "longitude": info["location"]["longitude"],
            "geocode_exact": geo.get("exact"), "facilities": facilities, "info_file": fold + "/info.json",
            "hero_image": fold + "/" + info["hero_image_file"] if info["hero_image_file"] else "fitogsund-logo.png"}


todo = houses[:LIMIT] if LIMIT else houses
with ThreadPoolExecutor(4) as ex:
    results = list(ex.map(process, todo))
results.sort(key=lambda r: r["address"])
if not LIMIT:
    with open(os.path.join(OUT, "alle-centre.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
print("done", len(results))
for r in results:
    print(r["folder"], "|", r["hero_image"], "| exact geo:", r["geocode_exact"])

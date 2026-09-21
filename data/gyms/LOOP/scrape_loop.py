"""Scraper for LOOP Fitness-centre (loopfitness.dk/centre).

Koer:  python scrape_loop.py        -> opdaterer alle centre i denne mappe
       python scrape_loop.py 3      -> kun de foerste 3 (test)

Data kommer fra det JSON-objekt ("var locations"), som loopfitness.dk/centre indlejrer,
suppleret med beskrivelse, faciliteter og billede fra hver centerside.
Hero-billedet komprimeres til maks 1200 px bredde, JPEG kvalitet 75 (kraever Pillow).
"""
import re, html, json, os, sys, io, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor

BASE = "https://loopfitness.dk"
OUT = os.path.dirname(os.path.abspath(__file__))
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FitVen-scraper"}
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else None
MAXW, QUALITY = 1200, 75
DAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"]


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
    t = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>|</td>|</tr>", "\n", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t).replace("\xa0", " ").replace("–", "-")
    t = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in t.split("\n"))
    return re.sub(r"\n\s*\n+", "\n", t).strip()


def safe_name(s):
    s = re.sub(r'[<>:"/\\|?*]', "-", s)
    return re.sub(r"\s+", " ", s).strip(" .")


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


def money(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------- listing (embedded JSON) ----------
listing = get(BASE + "/centre/")
start = listing.find("var locations = ")
obj, _ = json.JSONDecoder().raw_decode(listing[listing.find("{", start):])
gyms = list(obj.values())
print("gyms:", len(gyms))


def parse_detail(url):
    page = get(url)
    d = {}
    md = re.search(r'<meta name="description" content="([^"]*)"', page)
    d["meta_description"] = html.unescape(md.group(1)) if md else None
    og = re.search(r'<meta property="og:image" content="([^"]*)"', page)
    d["og_image"] = html.unescape(og.group(1)) if og else None
    cover = re.search(r'<img[^>]*class="wp-block-cover__image-background[^"]*"[^>]*data-src="([^"]+)"', page)
    d["cover_image"] = html.unescape(cover.group(1)) if cover else None
    d["facilities"] = []
    offers = re.search(r'<div class="loop-center-offers">(.*?)<h2', page, re.S)
    if offers:
        for info in re.findall(r'<div class="info-text"[^>]*>(.*?)</div>', offers.group(1), re.S):
            t = text(info).replace("\n", " ")
            if t and not re.search(r"medlemmer", t, re.I):
                d["facilities"].append(t)
    welcome = re.search(r'<h3[^>]*>Velkommen</h3>(.*?)</div>', page, re.S)
    if welcome:
        paras = [text(p) for p in re.findall(r"<p[^>]*>(.*?)</p>", welcome.group(1), re.S)]
        paras = [p for p in paras if p]
        d["description"] = "\n".join(p for p in paras if not p.lower().endswith("centerleder"))
        d["quote_by"] = next((p for p in paras if p.lower().endswith("centerleder")), None)
    else:
        d["description"], d["quote_by"] = None, None
    manned = re.search(r"<h3>Bemandede åbningstider</h3>(.*?)</div>\s*</div>", page, re.S)
    d["staffed_hours"] = []
    if manned:
        for day, cell in re.findall(r'<td class="first-col">(.*?)</td>\s*<td>(.*?)</td>', manned.group(1), re.S):
            d["staffed_hours"].append({"day": text(day), "periods": [x for x in text(cell).split("\n") if x]})
    return d


def process(g):
    url = g.get("url") or ""
    try:
        d = parse_detail(url) if url else {}
    except Exception as e:
        print("FAIL detail", url, e)
        d = {}
    street = " ".join(x for x in (g.get("address_line_1"), g.get("address_line_2")) if x).strip()
    address = f'{street}, {g.get("area_code")} {g.get("city")}'.strip(", ")
    folder = os.path.join(OUT, safe_name(address))
    os.makedirs(folder, exist_ok=True)

    hours = []
    for i, day in enumerate(DAYS, 1):
        o, c = g.get(f"day{i}_open"), g.get(f"day{i}_close")
        if o and c:
            hours.append({"day": day, "open": f"{o} - {c}".replace("23:59", "24:00")})
    manned_regular, manned_dates = [], []
    for p in g.get("manned_periods") or []:
        item = {"open": f'{p.get("starts_at")} - {p.get("ends_at")}'}
        if p.get("day_num"):
            manned_regular.append({"day": DAYS[(p["day_num"] - 1) % 7], **item})
        elif p.get("date"):
            manned_dates.append({"date": p["date"], **item})
    memberships = []
    for grp in g.get("public_groups") or []:
        memberships.append({
            "name": grp.get("name"), "price_per_month": money(grp.get("price")), "signup_fee": money(grp.get("signup_fee")),
            "admin_fee": money(grp.get("admin_fee")), "intro_price": money(grp.get("trial_period_1_price")),
            "intro_months": grp.get("trial_period_1_months"), "minimum_price": grp.get("minimum_price"),
            "family_members": grp.get("family_members"), "campaign": grp.get("is_campaign_offer"),
            "includes_classes": grp.get("classes"), "includes_weights": grp.get("weights"), "loop24": grp.get("loop24"),
            "local_gym_only": grp.get("local_gym_only"), "cancellation_notice_days": grp.get("cancellation_notice"),
        })
    hero_url = d.get("cover_image") or d.get("og_image")
    info = {
        "chain": "LOOP Fitness",
        "name": g.get("name"),
        "loop_id": g.get("id"),
        "center_type": g.get("type"),
        "address": {"street": street, "postal_code": g.get("area_code"), "city": g.get("city"), "country": g.get("country") or "DK", "full": address},
        "location": {"latitude": float(g["lat"]) if g.get("lat") else None, "longitude": float(g["lng"]) if g.get("lng") else None},
        "url": url or None,
        "membership_url": BASE + "/medlemskab/bliv-medlem/",
        "phone": g.get("phone"),
        "email": g.get("email"),
        "facebook_url": g.get("facebook_url") if (g.get("facebook_url") or "").startswith("http") else None,
        "google_review_url": g.get("feedback_url"),
        "cvr": g.get("cvr"),
        "manager_name": g.get("manager_name"),
        "opened": g.get("launch_date"),
        "has_classes": g.get("classes"),
        "only_open_when_staffed": g.get("only_open_when_manned"),
        "max_visitor_capacity": g.get("max_visitor_capacity"),
        "opening_hours": hours,
        "staffed_hours": d.get("staffed_hours") or manned_regular,
        "staffed_hours_dates": sorted(manned_dates, key=lambda x: x["date"]),
        "meta_description": d.get("meta_description"),
        "description": d.get("description"),
        "quote_by": d.get("quote_by"),
        "facilities": d.get("facilities"),
        "memberships": memberships,
        "images": {"hero": hero_url, "og_image": d.get("og_image")},
        "hero_image_file": None,
        "scraped_at": time.strftime("%Y-%m-%d"),
    }
    if hero_url:
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
    return {"name": info["name"], "address": address, "folder": fold, "url": info["url"],
            "latitude": info["location"]["latitude"], "longitude": info["location"]["longitude"],
            "loop_id": info["loop_id"], "center_type": info["center_type"], "facilities": info["facilities"],
            "info_file": fold + "/info.json",
            "hero_image": fold + "/" + info["hero_image_file"] if info["hero_image_file"] else None}


todo = gyms[:LIMIT] if LIMIT else gyms
with ThreadPoolExecutor(6) as ex:
    results = list(ex.map(process, todo))
results.sort(key=lambda r: r["address"])
if not LIMIT:
    with open(os.path.join(OUT, "alle-centre.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
print("done", len(results))
for r in results:
    print(r["folder"], "|", r["hero_image"])

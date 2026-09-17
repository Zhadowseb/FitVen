"""Scraper for PureGym-centre (puregym.dk/find-center).

Koer:  python scrape_puregym.py        -> opdaterer alle centre i denne mappe
       python scrape_puregym.py 3      -> kun de foerste 3 (test)
"""
import re, html, json, os, sys, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor

BASE = "https://www.puregym.dk"
OUT = os.path.dirname(os.path.abspath(__file__))
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FitVen-scraper"}
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else None


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


def strip_tags(s):
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"</(p|h[1-6]|div|li)>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = "\n".join(line.strip() for line in s.split("\n"))
    return re.sub(r"\n\s*\n+", "\n", s).strip()


def safe_name(s):
    s = re.sub(r'[<>:"/\\|?*]', "-", s)
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s


# ---------- listing ----------
listing = get(BASE + "/find-center")
FAC, ACT = {}, {}
for kind, val, label in re.findall(r'id="check_(facility|activity)_(\d+)" value="\d+"/>\s*<label[^>]*>([^<]+)<', listing):
    (FAC if kind == "facility" else ACT)[val] = html.unescape(label).strip()
teasers = re.findall(
    r'<div class="map__teaser" data="([^"]*)">(.*?)<a href="(/find-center/[^"]+)" class="map__teaser__button">',
    listing, re.S)
print("teasers:", len(teasers))

centers = []
for data, body, path in teasers:
    d = json.loads(html.unescape(data))
    img = re.search(r"background-image: url\(([^)]+)\)", body)
    addr = re.search(r'<p class="map__teaser__address">(.*?)</p>', body, re.S)
    price = re.search(r'<span class="map__teaser__price"[^>]*>(.*?)</span>', body, re.S)
    note = re.search(r'<span class="map__teaser__price__note">(.*?)</span>', body, re.S)
    member = re.search(r'href="(/bliv-medlem/[^"]+)"', body)
    addr_lines = [l for l in strip_tags(addr.group(1)).split("\n") if l] if addr else []
    centers.append({
        "id": d.get("id"),
        "title": d.get("title"),
        "latitude": d.get("latitude"),
        "longitude": d.get("longitude"),
        "facility_ids": d.get("facilities", []),
        "plan_ids": d.get("plans", []),
        "team_ids": d.get("teams", []),
        "teaser_image": html.unescape(img.group(1)) if img else None,
        "address_lines": addr_lines,
        "price_from": strip_tags(price.group(1)) if price else None,
        "price_note": strip_tags(note.group(1)) if note else None,
        "membership_url": BASE + member.group(1) if member else None,
        "url": BASE + path,
        "slug": path.rsplit("/", 1)[-1],
    })


# ---------- detail ----------
def parse_detail(c):
    s = get(c["url"])
    out = {}
    ld = {}
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)
    if m:
        try:
            ld = json.loads(m.group(1))
        except Exception as e:
            print("ld+json fail", c["slug"], e)
    out["name"] = ld.get("name")
    a = ld.get("address", {})
    out["street"] = a.get("streetAddress")
    out["postal_code"] = a.get("postalCode")
    out["city"] = a.get("addressLocality")
    out["gallery_images"] = ld.get("image", [])
    out["opening_hours_schema"] = [
        {"day": o.get("dayOfWeek"), "opens": o.get("opens"), "closes": o.get("closes"),
         "valid_from": o.get("validFrom"), "valid_through": o.get("validThrough")}
        for o in ld.get("openingHoursSpecification", [])]
    out["special_days"] = [
        {"date": o.get("validFrom"), "opens": o.get("opens"), "closes": o.get("closes")}
        for o in ld.get("openingHoursSpecification", []) if not o.get("dayOfWeek")]
    out["opening_hours_schema"] = [x for x in out["opening_hours_schema"] if x["day"]]
    for x in out["opening_hours_schema"]:
        x.pop("valid_from"); x.pop("valid_through")

    og = re.search(r'<meta property="og:image" content="([^"]+)"', s)
    out["hero_image"] = html.unescape(og.group(1)) if og else None
    # the hero css block: .center-hero-<id>--<n> { background-image: ... }  (first one is the hero, not the warning box)
    hero_blocks = re.findall(r"\.center-hero-\d+--\d+\s*\{\s*background-image:\s*url\('([^']+)'\)", s)
    hero_css = None
    for hb in re.finditer(r'<div class="hero__background (center-hero-\d+--\d+)"', s):
        cls = hb.group(1)
        mm = re.search(re.escape(cls) + r"\s*\{\s*background-image:\s*url\('([^']*hero_2500x2500[^']+)'\)", s)
        if mm:
            hero_css = html.unescape(mm.group(1))
            break
    out["hero_image_2500"] = hero_css

    md = re.search(r'<meta name="description" content="([^"]*)"', s)
    out["meta_description"] = html.unescape(md.group(1)) if md else None
    t = re.search(r"<title>(.*?)</title>", s, re.S)
    out["page_title"] = strip_tags(t.group(1)) if t else None

    hours = []
    for item in re.findall(r'<div class="text-teaser__item">(.*?)</div>', s, re.S):
        title = re.search(r'text-teaser__title">(.*?)</p>', item, re.S)
        text = re.search(r'text-teaser__text">(.*?)</p>', item, re.S)
        note = re.search(r'text-teaser__note">(.*?)</p>', item, re.S)
        if title and text:
            hours.append({
                "day": strip_tags(title.group(1)),
                "open": strip_tags(text.group(1)),
                "staffed": strip_tags(note.group(1)).replace("Bemandet:", "").strip() if note else None,
            })
    out["opening_hours"] = hours
    closing = re.search(r'hero__icon--clock">(.*?)</span>', s, re.S)
    out["today_notice"] = strip_tags(closing.group(1)) if closing else None

    facs = []
    parts = s.split('<div class="disclosure__item js-disclosure-item">')[1:]
    for item in parts:
        head = re.search(r'disclosure__head js-disclosure-toggle">(.*?)</div>', item, re.S)
        text = re.search(r'<div class="tile__text">(.*?)</div>', item, re.S)
        img = re.search(r"url\('([^']*hero_2500x2500[^']+)'\)", item)
        if head:
            facs.append({
                "name": strip_tags(head.group(1)),
                "description": strip_tags(text.group(1)) if text else None,
                "image": html.unescape(img.group(1)) if img else None,
            })
    out["facilities"] = facs

    wb = re.search(r'<div class="warning-box">(.*?)<div class="hero">', s, re.S)
    if wb:
        wt = re.search(r'warning-box__title">(.*?)</h2>', wb.group(1), re.S)
        wx = re.search(r'warning-box__text">(.*?)$', wb.group(1), re.S)
        out["notice"] = {"title": strip_tags(wt.group(1)) if wt else None,
                         "text": strip_tags(wx.group(1)) if wx else None}
    else:
        out["notice"] = None

    art = s[s.find("<article"):]
    end = art.find('class="disclosure')
    body = art[:end] if end > 0 else art
    last = body.rfind("text-teaser__item")
    if last > 0:
        body = body[body.find("</div>", last):]
    body = re.sub(r"<script.*?</script>|<style.*?</style>", "", body, flags=re.S)
    desc = strip_tags(body)
    desc = re.sub(r"^Vi tilbyder$", "", desc, flags=re.M).strip()
    out["description"] = desc
    return out


def process(c):
    try:
        d = parse_detail(c)
    except Exception as e:
        print("FAIL detail", c["slug"], e)
        d = {}
    street = d.get("street") or (c["address_lines"][0] if c["address_lines"] else c["title"])
    pc_city = f'{d.get("postal_code") or ""} {d.get("city") or ""}'.strip()
    if not pc_city and len(c["address_lines"]) > 1:
        pc_city = c["address_lines"][1]
    address = f"{street}, {pc_city}".strip(", ")
    folder = os.path.join(OUT, safe_name(address))
    os.makedirs(folder, exist_ok=True)
    info = {
        "chain": "PureGym",
        "name": d.get("name") or c["title"],
        "puregym_id": c["id"],
        "address": {"street": street, "postal_code": d.get("postal_code"), "city": d.get("city"),
                    "country": "DK", "full": address},
        "location": {"latitude": c["latitude"], "longitude": c["longitude"]},
        "url": c["url"],
        "membership_url": c["membership_url"],
        "price_from": c["price_from"],
        "price_note": c["price_note"],
        "today_notice": d.get("today_notice"),
        "opening_hours": d.get("opening_hours"),
        "opening_hours_schema": d.get("opening_hours_schema"),
        "special_days": d.get("special_days"),
        "meta_description": d.get("meta_description"),
        "description": d.get("description"),
        "notice": d.get("notice"),
        "facilities": d.get("facilities"),
        "facility_names": sorted(FAC[i] for i in c["facility_ids"] if i in FAC),
        "facility_ids": c["facility_ids"],
        "plan_ids": c["plan_ids"],
        "team_ids": c["team_ids"],
        "classes": sorted(ACT[i] for i in c["team_ids"] if i in ACT),
        "images": {"hero": d.get("hero_image"), "hero_2500": d.get("hero_image_2500"),
                   "teaser": c["teaser_image"], "gallery": d.get("gallery_images")},
        "hero_image_file": None,
        "scraped_at": time.strftime("%Y-%m-%d"),
    }
    img_url = d.get("hero_image") or d.get("hero_image_2500") or c["teaser_image"]
    if img_url:
        ext = os.path.splitext(urllib.parse.urlparse(img_url).path)[1].lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"
        fn = "hero" + ext
        try:
            data = get(img_url, binary=True)
            with open(os.path.join(folder, fn), "wb") as f:
                f.write(data)
            info["hero_image_file"] = fn
        except Exception as e:
            print("FAIL image", c["slug"], e)
    with open(os.path.join(folder, "info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    fold = os.path.basename(folder)
    return {"name": info["name"], "address": address, "folder": fold, "url": c["url"],
            "latitude": c["latitude"], "longitude": c["longitude"], "price_from": c["price_from"],
            "hero_image_file": info["hero_image_file"], "puregym_id": c["id"],
            "facility_names": info["facility_names"], "info_file": fold + "/info.json",
            "hero_image": fold + "/" + info["hero_image_file"] if info["hero_image_file"] else None}


todo = centers[:LIMIT] if LIMIT else centers
os.makedirs(OUT, exist_ok=True)
with ThreadPoolExecutor(6) as ex:
    results = list(ex.map(process, todo))
results.sort(key=lambda r: r["address"])
if not LIMIT:
    with open(os.path.join(OUT, "alle-centre.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
print("done", len(results))
for r in results:
    print(r["folder"], "|", r["hero_image_file"])

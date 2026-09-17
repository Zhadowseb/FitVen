"""Scraper for FitnessX-centre (fitnessx.dk/find-center).

Koer:  python scrape_fitnessx.py        -> opdaterer alle centre i denne mappe
       python scrape_fitnessx.py 3      -> kun de foerste 3 (test)

Hero-billedet komprimeres til maks 1200 px bredde, JPEG kvalitet 75 (kraever Pillow).
"""
import re, html, json, os, sys, io, urllib.request, urllib.parse, time
from concurrent.futures import ThreadPoolExecutor

BASE = "https://fitnessx.dk"
OUT = os.path.dirname(os.path.abspath(__file__))
HDR = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FitVen-scraper"}
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else None
MAXW, QUALITY = 1200, 75


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
    t = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>", "\n", t)
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


# ---------- listing ----------
listing = get(BASE + "/find-center/")
items = re.findall(r'<div class="center_map_list_item([^"]*)" long="([^"]*)" lat="([^"]*)" id="map_item\d+" ref-logo="([^"]*)" ref-campain="([^"]*)"[^>]*>(.*?)(?=<div class="center_map_list_item |<!--\s*#center_map_list_wrapper|</div>\s*</div>\s*<div id=")', listing, re.S)
centers = []
for cls, lng, lat, logo, campaign, body in items:
    name = re.search(r'<h2 class="center_map_yellow_nomore_layer_wrapper"[^>]*>(.*?)</h2>', body, re.S)
    label = re.search(r'center_map_list_item_label[^"]*">(.*?)</div>', body, re.S)
    maps = re.search(r'center_map_list_item_adr"\s*><a href="([^"]+)"', body)
    p1 = re.search(r'adr_part1">(.*?)</span>', body, re.S)
    p2 = re.search(r'adr_part2">(.*?)</span>', body, re.S)
    p3 = re.search(r'adr_part3">(.*?)</span>', body, re.S)
    feats = [text(x) for x in re.findall(r'checkmark-text[^"]*">(.*?)</span>', body, re.S)]
    link = re.search(r'<a href="(https://fitnessx\.dk/fitness/[^"]+)" class="btn_center"', body)
    if not link:
        continue
    centers.append({
        "name": text(name.group(1)) if name else None,
        "label": text(label.group(1)) if label else None,
        "tags": [c for c in cls.split() if c],
        "campaign": campaign != "no",
        "latitude": float(lat) if lat else None,
        "longitude": float(lng) if lng else None,
        "hero": html.unescape(logo),
        "google_maps_url": html.unescape(maps.group(1)) if maps else None,
        "street": text(p1.group(1)) if p1 else "",
        "postal_code": text(p2.group(1)) if p2 else "",
        "city": text(p3.group(1)) if p3 else "",
        "features": feats,
        "url": link.group(1),
    })
print("centers:", len(centers))

WIDGET = re.compile(r'<div class="elementor-element elementor-element-\w+[^"]*elementor-widget[^"]*" data-id="\w+" data-element_type="widget"[^>]*data-widget_type="([\w.-]+)"[^>]*>(.*?)(?=<div class="elementor-element elementor-element-\w+)', re.S)
TIME_RE = re.compile(r"\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}|bent|ukket|24/7", re.I)


def widgets(page):
    body = page[page.find("<body"):]
    out = []
    for wtype, inner in WIDGET.findall(body):
        t = text(inner)
        if wtype.startswith(("heading", "text-editor", "button")) and t:
            out.append((wtype.split(".")[0], t))
    return out


def parse_detail(c):
    page = get(c["url"])
    w = widgets(page)
    heads = [t for k, t in w]
    d = {"opening_hours": [], "special_days_text": None, "description": None, "features_detail": [],
         "parking": None, "manager": None, "price_teaser": None}
    md = re.search(r'<meta name="description" content="([^"]*)"', page)
    d["meta_description"] = html.unescape(md.group(1)) if md else None
    ogt = re.search(r'<meta property="og:title" content="([^"]*)"', page)
    d["page_title"] = html.unescape(ogt.group(1)) if ogt else None

    # opening hours: heading "Åbningstider" followed by (time, day, [Bemandet]) triplets
    try:
        i = next(idx for idx, (k, t) in enumerate(w) if k == "heading" and t.lower().startswith("åbningstider")) + 1
    except StopIteration:
        i = None
    if i is not None:
        while i + 1 < len(w) and w[i][0] == "heading" and TIME_RE.search(w[i][1]) and w[i + 1][0] == "heading" and not w[i + 1][1].startswith("Bemandet"):
            row = {"days": w[i + 1][1], "open": w[i][1].replace(".", ":"), "staffed": None}
            i += 2
            if i < len(w) and w[i][1].startswith("Bemandet"):
                row["staffed"] = w[i][1].split(":", 1)[1].strip().replace(".", ":")
                i += 1
            d["opening_hours"].append(row)
        # special days + description + feature blocks until "Billeder"
        desc = []
        while i < len(w) and w[i][1] not in ("Billeder", "Find vej"):
            k, t = w[i]
            if k == "text-editor" and t.lower().startswith("særlige"):
                d["special_days_text"] = t
            elif k == "text-editor" and (i == 0 or w[i - 1][0] != "heading" or w[i - 1][1].startswith("Bemandet") or w[i - 1][1].lower().startswith("særlige")):
                desc.append(t)
            elif k == "heading" and i + 1 < len(w) and w[i + 1][0] == "text-editor":
                d["features_detail"].append({"title": t, "text": w[i + 1][1]})
                i += 1
            i += 1
        d["description"] = "\n".join(desc) or None

    for idx, (k, t) in enumerate(w):
        if k == "heading" and t == "Parkering" and idx + 1 < len(w):
            d["parking"] = w[idx + 1][1]
        if k == "heading" and t == "Mød os":
            rest = []
            for x in heads[idx + 1: idx + 6]:
                if x.startswith(("Følg os", "Andre centre", "Bliv medlem")):
                    break
                if not x.endswith(("?", ".")) and len(x) < 40:
                    rest.append(x)
            names = [x for x in rest if not x.isupper()]
            titles = [x for x in rest if x.isupper()]
            if names or titles:
                d["manager"] = {"name": names[0] if names else None, "title": titles[0].title() if titles else None}
        if k == "heading" and "kr./md" in t and not d["price_teaser"]:
            d["price_teaser"] = t
    d["campaign_headline"] = next((t for k, t in w if k == "heading" and t.isupper() and len(t) < 60 and "PRIS" in t), None)
    imgs = []
    for u in re.findall(r'https://fitnessx\.dk/wp-content/uploads/[^"\'\s)>]+\.(?:jpg|jpeg|webp)', page):
        u = re.sub(r"-\d+x\d+(?=\.\w+$)", "", html.unescape(u))
        if u not in imgs and not re.search(r"logo|badge|favicon|manager", u, re.I):
            imgs.append(u)
    d["gallery"] = imgs
    mgr_img = re.search(r'https://fitnessx\.dk/wp-content/uploads/[^"\'\s)>]*[Mm]anager[^"\'\s)>]*\.(?:jpg|jpeg|png|webp)', page)
    if d["manager"] and mgr_img:
        d["manager"]["image"] = re.sub(r"-\d+x\d+(?=\.\w+$)", "", mgr_img.group(0))
    return d


def process(c):
    try:
        d = parse_detail(c)
    except Exception as e:
        print("FAIL detail", c["url"], e)
        d = {}
    address = f'{c["street"]}, {c["postal_code"]} {c["city"]}'.strip(", ")
    folder = os.path.join(OUT, safe_name(address))
    os.makedirs(folder, exist_ok=True)
    info = {
        "chain": "FitnessX",
        "name": c["name"],
        "label": c["label"],
        "address": {"street": c["street"], "postal_code": c["postal_code"], "city": c["city"], "country": "DK", "full": address},
        "location": {"latitude": c["latitude"], "longitude": c["longitude"]},
        "url": c["url"],
        "google_maps_url": c["google_maps_url"],
        "membership_url": BASE + "/medlemskaber/",
        "campaign": c["campaign"],
        "campaign_headline": d.get("campaign_headline"),
        "price_teaser": d.get("price_teaser"),
        "opening_hours": d.get("opening_hours"),
        "special_days_text": d.get("special_days_text"),
        "meta_description": d.get("meta_description"),
        "description": d.get("description"),
        "features": c["features"],
        "features_detail": d.get("features_detail"),
        "parking": d.get("parking"),
        "manager": d.get("manager"),
        "tags": c["tags"],
        "images": {"hero": c["hero"], "gallery": d.get("gallery")},
        "hero_image_file": None,
        "scraped_at": time.strftime("%Y-%m-%d"),
    }
    try:
        raw = get(encode_url(c["hero"]), binary=True)
        data, ext = compress(raw)
        if ext is None:
            ext = os.path.splitext(c["hero"].split("?")[0])[1].lower() or ".jpg"
        fn = "hero" + ext
        for old in os.listdir(folder):
            if old.startswith("hero"):
                os.remove(os.path.join(folder, old))
        with open(os.path.join(folder, fn), "wb") as f:
            f.write(data)
        info["hero_image_file"] = fn
    except Exception as e:
        print("FAIL image", c["url"], e)
    with open(os.path.join(folder, "info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    fold = os.path.basename(folder)
    return {"name": info["name"], "address": address, "folder": fold, "url": c["url"],
            "latitude": c["latitude"], "longitude": c["longitude"], "label": c["label"],
            "features": c["features"], "info_file": fold + "/info.json",
            "hero_image": fold + "/" + info["hero_image_file"] if info["hero_image_file"] else None}


todo = centers[:LIMIT] if LIMIT else centers
with ThreadPoolExecutor(4) as ex:
    results = list(ex.map(process, todo))
results.sort(key=lambda r: r["address"])
if not LIMIT:
    with open(os.path.join(OUT, "alle-centre.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
print("done", len(results))
for r in results:
    print(r["folder"], "|", r["hero_image"])

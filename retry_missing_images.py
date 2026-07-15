"""
Retry the ASINs that failed the first pass. Only fetches ASINs missing from
./product-images/. Uses retries + longer/jittered backoff to dodge throttling,
and tries multiple page URL forms.
"""
import csv, os, re, random, time
import requests

SRC_CSV = "amazon_bestsellers.csv"
OUT_DIR = "product-images"
MAP_CSV = "image_map.csv"

UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:80]

def extract(html):
    for pat in (r'"hiRes":"(https://[^"]+?\.jpg)"',
                r'"large":"(https://[^"]+?\.jpg)"',
                r'data-old-hires="(https://[^"]+?\.jpg)"',
                r'id="landingImage"[^>]+src="(https://[^"]+?\.jpg)"',
                r'"mainUrl":"(https://[^"]+?\.jpg)"',
                r'(https://m\.media-amazon\.com/images/I/[A-Za-z0-9%+_-]+?\._[^"]*?\.jpg)'):
        m = re.search(pat, html)
        if m:
            return re.sub(r"\._[A-Z0-9,_]+_\.", "._AC_SL1000_.", m.group(1))
    return None

def fetch(asin):
    for attempt in range(3):
        ua = random.choice(UAS)
        h = {"User-Agent": ua, "Accept-Language": "en-US,en;q=0.9",
             "Accept": "text/html,application/xhtml+xml"}
        url = random.choice([f"https://www.amazon.com/dp/{asin}",
                             f"https://www.amazon.com/gp/product/{asin}"])
        try:
            r = requests.get(url, headers=h, timeout=30)
            img = extract(r.text)
            if img:
                return img
        except Exception:
            pass
        time.sleep(random.uniform(3, 6))
    return None

def main():
    rows = list(csv.DictReader(open(SRC_CSV, encoding="utf-8")))
    have = {f[:-4] for f in os.listdir(OUT_DIR) if f.endswith(".jpg")}
    missing = [r for r in rows if r["asin"].strip() not in have]
    print(f"{len(have)} present, {len(missing)} to retry")
    got = 0
    new_rows = []
    for i, r in enumerate(missing, 1):
        asin = r["asin"].strip()
        img_url = fetch(asin)
        if not img_url:
            print(f"[{i}/{len(missing)}] {asin} still missing");
            time.sleep(random.uniform(2, 4)); continue
        try:
            img = requests.get(img_url, headers={"User-Agent": random.choice(UAS)}, timeout=30)
            if img.status_code == 200 and len(img.content) > 1000:
                open(os.path.join(OUT_DIR, f"{asin}.jpg"), "wb").write(img.content)
                new_rows.append((asin, slugify(r["title"]), f"{asin}.jpg"))
                got += 1
                print(f"[{i}/{len(missing)}] {asin} OK ({len(img.content)//1024}KB)")
        except Exception as e:
            print(f"[{i}/{len(missing)}] {asin} img err {e}")
        time.sleep(random.uniform(2.5, 5))

    # append to map
    if new_rows:
        exists = os.path.exists(MAP_CSV)
        with open(MAP_CSV, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if not exists:
                w.writerow(["asin", "handle", "filename"])
            w.writerows(new_rows)
    print(f"\nRETRY DONE: +{got} recovered. Total now: {len(have)+got}")

if __name__ == "__main__":
    main()

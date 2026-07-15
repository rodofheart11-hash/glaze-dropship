"""
Scrape enrichment data from Amazon per ASIN:
  - description + "About this item" bullet features
  - real current price
  - star rating + review count
  - extra gallery image URLs (hi-res)
Output: amazon_data.json  { asin: {price, rating, reviews, bullets[], description, images[]} }

Personal/prototype use. Resumable: skips ASINs already in amazon_data.json.
"""
import csv, json, os, re, random, time
import requests

SRC_CSV = "amazon_bestsellers.csv"
OUT_JSON = "amazon_data.json"

UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]

def hdr():
    return {"User-Agent": random.choice(UAS),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml"}

def clean(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"')
    return re.sub(r"\s+", " ", s).strip()

def extract(html):
    d = {}
    # price
    m = (re.search(r'"priceAmount":\s*([0-9.]+)', html) or
         re.search(r'class="a-offscreen">\$([0-9,]+\.[0-9]{2})', html))
    if m:
        d["price"] = float(m.group(1).replace(",", ""))
    # rating
    m = re.search(r'([0-9.]+)\s+out of 5 stars', html)
    if m: d["rating"] = float(m.group(1))
    # review count
    m = re.search(r'([0-9,]+)\s+ratings?', html) or re.search(r'"totalReviewCount":\s*([0-9]+)', html)
    if m: d["reviews"] = int(m.group(1).replace(",", ""))
    # bullets (About this item)
    bullets = []
    fb = re.search(r'id="feature-bullets".*?</ul>', html, re.S)
    if fb:
        for li in re.findall(r'<span[^>]*class="a-list-item[^"]*"[^>]*>(.*?)</span>', fb.group(0), re.S):
            t = clean(li)
            if t and len(t) > 3 and "hide" not in t.lower(): bullets.append(t)
    d["bullets"] = bullets[:8]
    # description
    dm = re.search(r'id="productDescription".*?<p[^>]*>(.*?)</p>', html, re.S)
    if dm: d["description"] = clean(dm.group(1))[:1200]
    # extra images (hi-res gallery)
    imgs = []
    for m in re.finditer(r'"hiRes":"(https://[^"]+?\.jpg)"', html):
        u = m.group(1)
        if u not in imgs: imgs.append(u)
    d["images"] = imgs[:6]
    return d

def main():
    rows = list(csv.DictReader(open(SRC_CSV, encoding="utf-8")))
    data = {}
    if os.path.exists(OUT_JSON):
        data = json.load(open(OUT_JSON, encoding="utf-8"))
    s = requests.Session()
    ok = fail = 0
    for i, r in enumerate(rows, 1):
        asin = r["asin"].strip()
        if asin in data and data[asin].get("bullets"):
            continue
        for attempt in range(2):
            try:
                resp = s.get(f"https://www.amazon.com/dp/{asin}", headers=hdr(), timeout=30)
                info = extract(resp.text)
                if info.get("bullets") or info.get("price") or info.get("rating"):
                    data[asin] = info; ok += 1
                    print(f"[{i}/{len(rows)}] {asin} OK  price={info.get('price')} rating={info.get('rating')} bullets={len(info.get('bullets',[]))} imgs={len(info.get('images',[]))}")
                    break
                else:
                    if attempt == 1:
                        print(f"[{i}/{len(rows)}] {asin} empty"); fail += 1
                    time.sleep(random.uniform(3, 6))
            except Exception as e:
                if attempt == 1:
                    print(f"[{i}/{len(rows)}] {asin} ERR {e}"); fail += 1
                time.sleep(random.uniform(3, 6))
        # checkpoint every 15
        if i % 15 == 0:
            json.dump(data, open(OUT_JSON, "w", encoding="utf-8"))
        time.sleep(random.uniform(2, 4))
    json.dump(data, open(OUT_JSON, "w", encoding="utf-8"))
    print(f"\nDONE: {ok} scraped this run, {fail} failed. Total records: {len(data)}")

if __name__ == "__main__":
    main()

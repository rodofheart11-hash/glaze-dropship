"""
Download the MAIN Amazon product image for each of the 300 products.
Outputs:
  ./product-images/<asin>.jpg      (the image files)
  ./image_map.csv                  (asin,handle,filename)  — for Shopify wiring

Personal/prototype use. One image per product to keep it small.
"""
import csv, json, os, re, random, time, sys
import requests

SRC_CSV = "amazon_bestsellers.csv"
OUT_DIR = "product-images"
MAP_CSV = "image_map.csv"

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def slugify(title):
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:80]

def extract_main_image(html):
    for pat in (r'"hiRes":"(https://[^"]+?\.jpg)"',
                r'"large":"(https://[^"]+?\.jpg)"',
                r'data-old-hires="(https://[^"]+?\.jpg)"',
                r'id="landingImage"[^>]+src="(https://[^"]+?\.jpg)"'):
        m = re.search(pat, html)
        if m:
            u = m.group(1)
            return re.sub(r"\._[A-Z0-9,_]+_\.", "._AC_SL1000_.", u)
    return None

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = list(csv.DictReader(open(SRC_CSV, encoding="utf-8")))
    s = requests.Session(); s.headers.update(HEADERS)
    out = []
    ok = fail = skip = 0
    for i, r in enumerate(rows, 1):
        asin = r["asin"].strip()
        title = r["title"].strip()
        handle = slugify(title)
        dest = os.path.join(OUT_DIR, f"{asin}.jpg")
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            out.append((asin, handle, f"{asin}.jpg")); skip += 1
            print(f"[{i}/{len(rows)}] {asin} skip (have)"); continue
        try:
            resp = s.get(f"https://www.amazon.com/dp/{asin}", timeout=25)
            img_url = extract_main_image(resp.text)
            if not img_url:
                print(f"[{i}/{len(rows)}] {asin} NO IMAGE FOUND"); fail += 1; continue
            img = s.get(img_url, timeout=25)
            if img.status_code == 200 and len(img.content) > 1000:
                open(dest, "wb").write(img.content)
                out.append((asin, handle, f"{asin}.jpg")); ok += 1
                print(f"[{i}/{len(rows)}] {asin} OK ({len(img.content)//1024}KB)")
            else:
                print(f"[{i}/{len(rows)}] {asin} bad image resp"); fail += 1
        except Exception as e:
            print(f"[{i}/{len(rows)}] {asin} ERR {e}"); fail += 1
        time.sleep(random.uniform(1.0, 2.2))  # be polite / avoid blocks

    with open(MAP_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["asin", "handle", "filename"]); w.writerows(out)
    print(f"\nDONE: {ok} downloaded, {skip} already had, {fail} failed. Map -> {MAP_CSV}")

if __name__ == "__main__":
    main()

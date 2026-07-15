import os
import re
import requests
import csv

ASINS = ["B0CMQCZ76Y", "B0CKVYQRJG"]
SRC_CSV = "stylish_shortlist.csv"
IMG_DIR = "images"
LIMIT = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

def extract_images(html, limit):
    urls = []
    for m in re.finditer(r'"hiRes":"(https://[^"]+?\.jpg)"', html):
        urls.append(m.group(1))
    if not urls:
        for m in re.finditer(r'"large":"(https://[^"]+?\.jpg)"', html):
            urls.append(m.group(1))
    if not urls:
        m = re.search(r'id="landingImage"[^>]+src="(https://[^"]+?\.jpg)"', html)
        if m: urls.append(m.group(1))
    seen, out = set(), []
    for u in urls:
        u = re.sub(r"\._[A-Z0-9,_]+_\.", "._AC_SL1000_.", u)
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= limit:
            break
    return out

def restore():
    session = requests.Session()
    session.headers.update(HEADERS)
    for asin in ASINS:
        print(f"Restoring {asin}...")
        url = f"https://www.amazon.com/dp/{asin}"
        try:
            r = session.get(url, timeout=25)
        except Exception as e:
            print(f"Exception fetching {asin}: {e}")
            continue
        print(f"Status code for {asin}: {r.status_code}")
        if r.status_code != 200:
            continue
        img_urls = extract_images(r.text, LIMIT)
        print(f"Found {len(img_urls)} image URLs: {img_urls}")
        prod_dir = os.path.join(IMG_DIR, asin)
        os.makedirs(prod_dir, exist_ok=True)
        for n, iu in enumerate(img_urls):
            dest = os.path.join(prod_dir, f"{asin}_{n}.jpg")
            try:
                ir = session.get(iu, timeout=25)
                print(f"Image {n} status code: {ir.status_code}")
                if ir.status_code == 200:
                    with open(dest, "wb") as f:
                        f.write(ir.content)
                    print(f"  Restored {dest}")
            except Exception as e:
                print(f"Exception downloading image {n}: {e}")

if __name__ == "__main__":
    restore()

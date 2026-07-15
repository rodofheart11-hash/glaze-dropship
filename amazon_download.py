"""
Amazon product data + image downloader (personal research use only).

For each product in stylish_shortlist.csv:
  1. fetch the product page
  2. extract the hi-res image URLs from the embedded image JSON
  3. download the main image (and optionally more) to ./images/<asin>/
  4. write enriched data -> amazon_products_full.csv + .json

COPYRIGHT: Amazon product images are owned by Amazon/the brands. Use for
private research only. Do NOT republish them on your own storefront -- use
your dropship supplier's photos there.

Install:  pip install requests
"""

import csv
import json
import os
import random
import re
import time

import requests

SRC_CSV = "amazon_bestsellers.csv"     # full 300-product catalog
OUT_CSV = "amazon_products_full.csv"
OUT_JSON = "amazon_products_full.json"
IMG_DIR = "images"
IMAGES_PER_PRODUCT = 3                  # main + up to N-1 alternates

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
    "Connection": "keep-alive",
}


def make_session():
    s = requests.Session()
    s.headers.update(HEADERS)
    s.cookies.update({"i18n-prefs": "USD", "lc-main": "en_US"})
    return s


def is_captcha(html):
    return "Enter the characters you see below" in html or "validateCaptcha" in html


def extract_images(html, limit):
    """
    Amazon embeds image data in a JS blob: 'colorImages' / 'hiRes' / 'large'.
    Pull the hi-res URLs. Falls back to the main landing image.
    """
    urls = []

    # 1) hi-res URLs from the image-block JSON
    for m in re.finditer(r'"hiRes":"(https://[^"]+?\.jpg)"', html):
        urls.append(m.group(1))
    if not urls:
        for m in re.finditer(r'"large":"(https://[^"]+?\.jpg)"', html):
            urls.append(m.group(1))

    # 2) fallback: the main landing image element
    if not urls:
        m = re.search(r'id="landingImage"[^>]+src="(https://[^"]+?\.jpg)"', html)
        if m:
            urls.append(m.group(1))
        m2 = re.search(r'data-old-hires="(https://[^"]+?\.jpg)"', html)
        if m2:
            urls.append(m2.group(1))

    # de-dup, keep order, normalize to a large size
    seen, out = set(), []
    for u in urls:
        u = re.sub(r"\._[A-Z0-9,_]+_\.", "._AC_SL1000_.", u)
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= limit:
            break
    return out


def fetch(session, url, retries=3):
    for attempt in range(1, retries + 1):
        time.sleep(random.uniform(2.5, 5.5))
        try:
            r = session.get(url, timeout=25)
        except requests.RequestException as e:
            print(f"    net error: {e}")
            time.sleep(attempt * 8)
            continue
        if r.status_code == 200 and not is_captcha(r.text):
            return r.text
        print(f"    [try {attempt}] status={r.status_code} captcha={is_captcha(r.text)}")
        time.sleep(attempt * 10)
    return None


def download_image(session, url, dest):
    try:
        r = session.get(url, timeout=25)
        if r.status_code == 200 and r.content:
            with open(dest, "wb") as f:
                f.write(r.content)
            return len(r.content)
    except requests.RequestException as e:
        print(f"    img error: {e}")
    return 0


def main():
    if not os.path.exists(SRC_CSV):
        print(f"Missing {SRC_CSV}")
        return
    os.makedirs(IMG_DIR, exist_ok=True)

    with open(SRC_CSV, encoding="utf-8") as f:
        products = list(csv.DictReader(f))

    session = make_session()
    enriched = []

    for i, p in enumerate(products, 1):
        asin = (p.get("asin") or "").strip()
        title = (p.get("title") or "").strip()
        if not asin:
            continue
        print(f"[{i}/{len(products)}] {asin} {title[:45]}")

        url = f"https://www.amazon.com/dp/{asin}"
        html = fetch(session, url)
        if not html:
            print("    FAILED (blocked/captcha) -- skipping")
            p["images"] = ""
            enriched.append(p)
            continue

        img_urls = extract_images(html, IMAGES_PER_PRODUCT)
        prod_dir = os.path.join(IMG_DIR, asin)
        os.makedirs(prod_dir, exist_ok=True)

        local_paths = []
        for n, iu in enumerate(img_urls):
            dest = os.path.join(prod_dir, f"{asin}_{n}.jpg")
            size = download_image(session, iu, dest)
            if size:
                local_paths.append(dest)
                print(f"    saved {dest} ({size//1024} KB)")

        p["image_urls"] = " | ".join(img_urls)
        p["image_files"] = " | ".join(local_paths)
        enriched.append(p)

    # write enriched CSV + JSON
    if enriched:
        fields = list(enriched[0].keys())
        with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(enriched)
        with open(OUT_JSON, "w", encoding="utf-8") as f:
            json.dump(enriched, f, indent=2, ensure_ascii=False)

        got = sum(1 for e in enriched if e.get("image_files"))
        print(f"\nDone. {got}/{len(enriched)} products got images.")
        print(f"Data -> {OUT_CSV}, {OUT_JSON}")
        print(f"Images -> ./{IMG_DIR}/<asin>/")
    else:
        print("Nothing downloaded.")


if __name__ == "__main__":
    main()

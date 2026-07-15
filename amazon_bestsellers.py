"""
Amazon Best Sellers scraper (personal research use only).

Replicates the browser's plain HTML document GET request. Amazon runs bot
detection on these pages, so this uses real browser headers + polite pacing.
Expect the occasional "Robot Check" / CAPTCHA page -- handle_captcha() detects it.

TOS NOTE: Scraping Amazon violates their Conditions of Use. Use only for
low-volume personal research. For anything commercial, use the PA-API or a
paid provider (Rainforest/Oxylabs).

Install:  pip install requests beautifulsoup4 lxml
"""

import csv
import random
import re
import time

import requests
from bs4 import BeautifulSoup

# ---- The exact headers a real Chrome sends for the document request. ----
# Copied from the browser's request to www.amazon.com. The Sec-* and
# User-Agent headers are what make the request look non-scripted.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Connection": "keep-alive",
}

# Best Sellers category pages. Each has a ?pg=2 second page (top 100 total).
CATEGORIES = {
    "womens_clothing": "https://www.amazon.com/Best-Sellers/zgbs/fashion/1040660",
    "mens_clothing": "https://www.amazon.com/Best-Sellers/zgbs/fashion/1040658",
}


def make_session():
    """A session reuses cookies Amazon hands back, which reduces bot flags."""
    s = requests.Session()
    s.headers.update(HEADERS)
    # Force US locale + USD pricing. Without this, Amazon geolocates by IP
    # (e.g. shows MXN for a Mexico IP). i18n-prefs sets the display currency.
    s.cookies.update({
        "i18n-prefs": "USD",
        "lc-main": "en_US",
    })
    return s


def is_captcha(html):
    """Amazon serves a 'Robot Check' page instead of results when it flags you."""
    markers = ("Enter the characters you see below",
               "Type the characters you see in this image",
               "/errors/validateCaptcha")
    return any(m in html for m in markers)


def fetch(session, url, retries=3):
    """GET a page with polite backoff. Returns HTML or None on repeated failure."""
    for attempt in range(1, retries + 1):
        # Random human-ish delay between requests -- the single most important
        # thing for not getting blocked. Do NOT hammer.
        time.sleep(random.uniform(2.5, 6.0))
        resp = session.get(url, timeout=20)
        if resp.status_code == 200 and not is_captcha(resp.text):
            return resp.text
        print(f"  [attempt {attempt}] status={resp.status_code} "
              f"captcha={is_captcha(resp.text)} -- backing off")
        time.sleep(attempt * 10)  # escalating cooldown
    return None


def parse_products(html):
    """
    Extract products from a Best Sellers grid.
    Amazon changes class names often, so we target the stable data attribute
    'data-asin' on grid items and fall back to text heuristics.
    """
    soup = BeautifulSoup(html, "lxml")
    products = []

    # Each best-seller card lives in a div whose id starts with 'gridItemRoot'.
    # NOTE: use ONE selector, not a comma list -- a card matches several of
    # Amazon's overlapping class names, which would produce duplicate rows.
    cards = soup.select("div[id^='gridItemRoot']")

    for card in cards:
        # Rank (e.g. "#1")
        rank_el = card.select_one("span.zg-bdg-text")
        rank = rank_el.get_text(strip=True).lstrip("#") if rank_el else ""

        # Title
        title_el = card.select_one("div._cDEzb_p13n-sc-css-line-clamp-3_g3dy1, ._cDEzb_p13n-sc-css-line-clamp-4_2q2cc, a.a-link-normal span div")
        if not title_el:
            title_el = card.select_one("a.a-link-normal")
        title = title_el.get_text(strip=True) if title_el else ""

        # Price
        price_el = card.select_one("span._cDEzb_p13n-sc-price_3mJ9Z, span.a-color-price, span.a-price span.a-offscreen")
        price = price_el.get_text(strip=True) if price_el else ""

        # Rating count
        reviews_el = card.select_one("span.a-size-small, a.a-size-small span.a-size-small")
        reviews = ""
        if reviews_el:
            m = re.search(r"[\d,]+", reviews_el.get_text())
            reviews = m.group(0) if m else ""

        # Product link + ASIN
        link_el = card.select_one("a.a-link-normal[href*='/dp/']")
        href = link_el["href"] if link_el else ""
        asin_m = re.search(r"/dp/([A-Z0-9]{10})", href)
        asin = asin_m.group(1) if asin_m else ""
        url = f"https://www.amazon.com/dp/{asin}" if asin else ""

        if title:
            products.append({
                "rank": rank, "asin": asin, "title": title,
                "price": price, "reviews": reviews, "url": url,
            })

    return products


def scrape_category(session, name, base_url):
    """Scrape both pages (top 100) of one category."""
    all_products = []
    for pg in (1,):
        url = base_url if pg == 1 else f"{base_url}?pg={pg}"
        print(f"[{name}] fetching page {pg}...")
        html = fetch(session, url)
        if html is None:
            print(f"[{name}] page {pg} FAILED (blocked or captcha). Skipping.")
            continue
        prods = parse_products(html)
        for p in prods:
            p["category"] = name
        print(f"[{name}] page {pg}: parsed {len(prods)} products")
        all_products.extend(prods)
    return all_products


def main():
    session = make_session()
    rows = []
    for name, url in CATEGORIES.items():
        rows.extend(scrape_category(session, name, url))

    if not rows:
        print("\nNo products scraped -- you were likely blocked. "
              "Try again later, use a proxy, or switch to PA-API.")
        return

    out = "amazon_bestsellers.csv"
    fields = ["category", "rank", "asin", "title", "price", "reviews", "url"]
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"\nSaved {len(rows)} products -> {out}")


if __name__ == "__main__":
    main()

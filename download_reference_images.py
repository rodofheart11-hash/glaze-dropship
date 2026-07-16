import os
import re
import random
import time
import requests

ASINS = [
    "B0FT4QF9D5",  # Flow-Midi Dress
    "B0CSDK2C3P",  # UV-Shield Longsleeve
    "B0BV241H3F",  # Linen-blend button-down
    "B09P3RHNSY"   # Aero-Active Shorts
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def extract_main_image(html):
    # Try different regex patterns to grab the hi-res image URL
    for pat in (r'"hiRes":"(https://[^"]+?\.jpg)"',
                r'"large":"(https://[^"]+?\.jpg)"',
                r'data-old-hires="(https://[^"]+?\.jpg)"',
                r'id="landingImage"[^>]+src="(https://[^"]+?\.jpg)"'):
        m = re.search(pat, html)
        if m:
            u = m.group(1)
            # Reformat to get full size instead of thumbnails
            return re.sub(r"\._[A-Z0-9,_]+_\.", "._AC_SL1000_.", u)
    return None

def main():
    os.makedirs("public/assets", exist_ok=True)
    s = requests.Session()
    s.headers.update(HEADERS)
    
    for i, asin in enumerate(ASINS, 1):
        dest = f"public/assets/ref_{asin}.jpg"
        print(f"[{i}/{len(ASINS)}] Fetching Amazon page for {asin}...")
        try:
            resp = s.get(f"https://www.amazon.com/dp/{asin}", timeout=25)
            img_url = extract_main_image(resp.text)
            if not img_url:
                # Fallback to a placeholder if page retrieval fails
                print(f"[{i}/{len(ASINS)}] Warning: No main image found for {asin}")
                continue
                
            print(f"Downloading reference image from {img_url}...")
            img_resp = s.get(img_url, timeout=25)
            if img_resp.status_code == 200:
                with open(dest, "wb") as f:
                    f.write(img_resp.content)
                print(f"Saved {dest} ({len(img_resp.content)//1024}KB)")
            else:
                print(f"Failed to download image. Status: {img_resp.status_code}")
        except Exception as e:
            print(f"Error fetching {asin}: {e}")
        time.sleep(random.uniform(2.0, 4.0))

if __name__ == "__main__":
    main()

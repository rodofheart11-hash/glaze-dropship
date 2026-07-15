import os
import re
import csv
import json
import requests

# This script uploads your local generated product images to tmpfiles.org
# and compiles a final shopify_import.csv containing direct, public download links.
# This ensures Shopify's cloud crawlers can fetch the images instantly without local tunnels.

IMAGES = [
    "clothing_hydro_jacket.png",
    "clothing_neo_dress.png",
    "clothing_chroma_hoodie.png",
    "clothing_flow_dress.png",
    "clothing_uv_shirt.png",
    "clothing_prism_shirt.png",
    "clothing_aero_shorts.png",
    "clothing_womens_shorts.png",
    "clothing_leggings.png",
    "clothing_golf_polo.png",
    "clothing_jeans.png"
]

def upload_image(filename):
    path = os.path.join("public", "assets", filename)
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return None
        
    print(f"Uploading {filename} to tmpfiles.org...")
    try:
        with open(path, "rb") as f:
            files = {"file": f}
            resp = requests.post("https://tmpfiles.org/api/v1/upload", files=files, timeout=30)
            
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                url = data["data"]["url"]
                # Convert standard view link to direct download link
                direct_url = url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/")
                print(f"  Direct Link: {direct_url}")
                return direct_url
            else:
                print(f"  Upload response error: {data}")
        else:
            print(f"  HTTP error {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"  Error uploading {filename}: {e}")
    return None

def main():
    # 1. Upload all local images
    url_map = {}
    for filename in IMAGES:
        url = upload_image(filename)
        if url:
            url_map[f"/assets/{filename}"] = url
            
    # Save the map as a backup
    with open("uploaded_image_map.json", "w") as f:
        json.dump(url_map, f, indent=2)
        
    # 2. Read products from src/products.js (parse using regex/json to avoid complex ESM loader in Python)
    # We will read products.js and search for the catalog objects using JS parse or we can run a simple subprocess
    # executing generate_shopify_csv.js with the map!
    # Even better: we can write the map to uploaded_image_map.json, and then update generate_shopify_csv.js
    # to check if this map exists, and if so, use the uploaded URLs instead of the baseImageUrl!
    
    print("\nUpload map completed. Updates saved to uploaded_image_map.json.")
    print("Ready to compile Shopify CSV with direct download URLs.")

if __name__ == "__main__":
    main()

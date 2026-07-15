import os
import re

# List of all PNG filenames that are actually JPEGs
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
    "clothing_jeans.png",
    "hero_glass_bg.png"
]

def main():
    assets_dir = os.path.join("public", "assets")
    
    # 1. Rename files from .png to .jpg
    for filename in IMAGES:
        old_path = os.path.join(assets_dir, filename)
        new_filename = filename.replace(".png", ".jpg")
        new_path = os.path.join(assets_dir, new_filename)
        
        if os.path.exists(old_path):
            # If the destination already exists, delete it first to avoid conflicts
            if os.path.exists(new_path):
                os.remove(new_path)
            os.rename(old_path, new_path)
            print(f"Renamed: {old_path} -> {new_path}")
        else:
            print(f"File not found to rename: {old_path}")

if __name__ == "__main__":
    main()

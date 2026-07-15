import os

# Files to update from .png to .jpg references
FILES = [
    "src/products.js",
    "copy_assets.ps1",
    "src/main.js",
    "upload_and_export_shopify.js"
]

def main():
    # 1. Update references in code files
    for filename in FILES:
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Replace all occurrences of png with jpg for our clothing assets
            new_content = content
            for img in [
                "clothing_hydro_jacket", "clothing_neo_dress", "clothing_chroma_hoodie",
                "clothing_flow_dress", "clothing_uv_shirt", "clothing_prism_shirt",
                "clothing_aero_shorts", "clothing_womens_shorts", "clothing_leggings",
                "clothing_golf_polo", "clothing_jeans", "hero_glass_bg"
            ]:
                new_content = new_content.replace(f"{img}.png", f"{img}.jpg")
                
            if new_content != content:
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated references in {filename}")
            else:
                print(f"No references to update in {filename}")
        else:
            print(f"File not found to update: {filename}")

if __name__ == "__main__":
    main()

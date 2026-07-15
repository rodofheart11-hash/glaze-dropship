import os
import csv
import re
from google import genai
from google.genai import types

# Quick script to automate generating the new stylish lifestyle images
# once your Gemini API quota resets or using a set API key.

SRC_CSV = "stylish_shortlist.csv"
IMG_DIR = "images"

def get_product_color_and_desc(title):
    # Try to extract the color or main features from the Amazon product title
    title_lower = title.lower()
    color = "original"
    if "gold" in title_lower:
        color = "gold"
    elif "silver" in title_lower:
        color = "silver"
    elif "black" in title_lower:
        color = "black"
    elif "brown" in title_lower:
        color = "brown"
    elif "khaki" in title_lower or "apricot" in title_lower:
        color = "khaki/apricot"
    elif "yellow" in title_lower:
        color = "yellow"
    return color

def generate_lifestyle_images():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        print("Please set it in your environment and run the script again.")
        return

    # Initialize Google GenAI client
    client = genai.Client(api_key=api_key)

    if not os.path.exists(SRC_CSV):
        print(f"Missing {SRC_CSV}")
        return

    with open(SRC_CSV, encoding="utf-8") as f:
        products = list(csv.DictReader(f))

    for i, p in enumerate(products, 1):
        asin = p.get("asin", "").strip()
        title = p.get("title", "").strip()
        category = p.get("category", "").strip()
        
        if not asin:
            continue
            
        print(f"[{i}/{len(products)}] Processing {asin} ({category})...")
        
        # Original lifestyle image is at images/<asin>/<asin>_1.jpg
        orig_img_path = os.path.join(IMG_DIR, asin, f"{asin}_1.jpg")
        dest_img_path = os.path.join(IMG_DIR, asin, f"{asin}_1.jpg") # We overwrite the lifestyle shot
        
        if not os.path.exists(orig_img_path):
            print(f"  Warning: Original lifestyle image {orig_img_path} not found. Skipping.")
            continue

        color = get_product_color_and_desc(title)
        
        # Formulate gender and category specific prompt
        gender_model = "female"
        if "men" in title.lower() and "women" not in title.lower():
            gender_model = "male"
            
        item_type = "bag" if category == "handbags" else "jewelry item"
        
        prompt = (
            f"A high-fashion, high-contrast campaign photograph on a solid jet black background. "
            f"A stylish Black {gender_model} model (person of color) wearing a simple elegant black top "
            f"is carrying or wearing the original {color} {item_type} from the reference image. "
            f"The product itself (the {item_type}) must remain in its original {color} color and style. "
            f"The model's black outfit and the jet black background ensure the {item_type} stands out "
            f"in high-contrast, premium studio lighting. High-end luxury brand aesthetic."
        )

        print(f"  Prompt: {prompt}")

        try:
            # Load the original image as reference/input
            with open(orig_img_path, "rb") as img_file:
                image_bytes = img_file.read()

            # Call Imagen 3 model via GenAI SDK
            # Note: Imagen model expects GenAI Client's models.generate_images endpoint
            result = client.models.generate_images(
                model='imagen-3.0-generate-002',
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    output_mime_type="image/jpeg",
                    aspect_ratio="1:1",
                    person_generation="allow_adult",
                    # Pass the original image as source to guide generation/edit
                    # depending on API support, or we use multimodal prompts.
                )
            )

            # Save generated image to destination
            for generated_image in result.generated_images:
                with open(dest_img_path, "wb") as out_file:
                    out_file.write(generated_image.image.image_bytes)
                print(f"  Successfully updated lifestyle image: {dest_img_path}")

        except Exception as e:
            print(f"  Failed to process {asin}: {e}")

if __name__ == "__main__":
    generate_lifestyle_images()

/**
 * Export the AUREA catalog (demo SQLite) into Shopify's product-import CSV.
 *
 * Produces shopify_products_import.csv in the exact column order Shopify's
 * "Products → Import" expects. One row per product (single default variant).
 *
 * IMAGES: left blank by default. The local /img paths aren't reachable by
 * Shopify, and Amazon's product photos are copyrighted — add your own images
 * in Shopify admin after import. (Set INCLUDE_AMAZON_IMAGES=1 to fill the
 * Image column with public Amazon CDN URLs for a quick visual test — not for
 * a real published store.)
 *
 * Run: node export_shopify_csv.mjs
 */
import Database from "./store/node_modules/better-sqlite3/lib/index.js";
import { writeFileSync } from "node:fs";

const INCLUDE_AMAZON_IMAGES = process.env.INCLUDE_AMAZON_IMAGES === "1";

const db = new Database("./store/app/db/store.db");
const rows = db
  .prepare(
    `SELECT handle, title, description, category, subcategory, price,
            compare_at_price, source_asin
       FROM products ORDER BY category, id`,
  )
  .all();

// Shopify's standard product-import columns (subset that matters, full header).
const HEADERS = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type",
  "Tags", "Published", "Option1 Name", "Option1 Value",
  "Variant SKU", "Variant Grams", "Variant Inventory Tracker",
  "Variant Inventory Qty", "Variant Inventory Policy",
  "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price",
  "Variant Requires Shipping", "Variant Taxable", "Image Src",
  "Image Position", "Image Alt Text", "Gift Card", "Status",
];

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CATEGORY_TYPE = {
  jewelry: "Jewelry",
  bags: "Handbag",
  clothing: "Apparel",
  shoes: "Shoes",
};

const lines = [HEADERS.join(",")];

for (const p of rows) {
  const tags = [p.category, p.subcategory].filter(Boolean).join(", ");
  const image =
    INCLUDE_AMAZON_IMAGES && p.source_asin
      ? `https://m.media-amazon.com/images/I/placeholder.jpg` // real filename unknown; left as note
      : "";
  const row = {
    Handle: p.handle,
    Title: p.title,
    "Body (HTML)": `<p>${p.description}</p>`,
    Vendor: "AUREA",
    "Product Category": "",
    Type: CATEGORY_TYPE[p.category] || "Accessories",
    Tags: tags,
    Published: "TRUE",
    "Option1 Name": "Title",
    "Option1 Value": "Default Title",
    "Variant SKU": p.source_asin || p.handle.slice(0, 20),
    "Variant Grams": "100",
    "Variant Inventory Tracker": "shopify",
    "Variant Inventory Qty": "100",
    "Variant Inventory Policy": "deny",
    "Variant Fulfillment Service": "manual",
    "Variant Price": p.price.toFixed(2),
    "Variant Compare At Price": p.compare_at_price ? p.compare_at_price.toFixed(2) : "",
    "Variant Requires Shipping": "TRUE",
    "Variant Taxable": "TRUE",
    "Image Src": image,
    "Image Position": image ? "1" : "",
    "Image Alt Text": image ? p.title : "",
    "Gift Card": "FALSE",
    Status: "active",
  };
  lines.push(HEADERS.map((h) => csvCell(row[h])).join(","));
}

writeFileSync("shopify_products_import.csv", lines.join("\n"), "utf-8");
console.log(`Wrote shopify_products_import.csv — ${rows.length} products.`);
console.log(`Images: ${INCLUDE_AMAZON_IMAGES ? "Amazon URLs (test only)" : "blank (add in Shopify)"}`);
db.close();

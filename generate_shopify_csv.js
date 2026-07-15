/**
 * GLAZE® Shopify CSV Exporter
 * 
 * Generates a standard, multi-variant Shopify Product Import CSV file from src/products.js.
 * Automatically expands sizes into Variant options so Shopify creates size dropdowns.
 * 
 * Usage:
 *   node generate_shopify_csv.js <BaseImageUrl>
 * 
 * Example:
 *   node generate_shopify_csv.js https://my-ngrok-tunnel.ngrok-free.app
 */

import { writeFileSync } from 'node:fs';
import { PRODUCTS } from './src/products.js';

// Get base URL for images from command line arguments
const baseImageUrl = process.argv[2] || 'https://glaze-store.com';

const HEADERS = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type",
  "Tags", "Published", "Option1 Name", "Option1 Value",
  "Variant SKU", "Variant Grams", "Variant Inventory Tracker",
  "Variant Inventory Qty", "Variant Inventory Policy",
  "Variant Fulfillment Service", "Variant Price",
  "Variant Requires Shipping", "Variant Taxable", "Image Src",
  "Image Position", "Status"
];

// Helper to escape CSV cells
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Helper to slugify handles
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9 -]/g, '')     // remove invalid chars
    .replace(/\s+/g, '-')            // collapse whitespace
    .replace(/-+/g, '-')             // collapse dashes
    .trim();
};

const lines = [HEADERS.join(",")];

PRODUCTS.forEach((product) => {
  const handle = slugify(product.name);
  const tags = [product.category, product.tag].filter(Boolean).join(", ");
  
  // Format description with a specs list in HTML
  let specsHTML = "";
  if (product.specs) {
    specsHTML = "<h3>Specifications</h3><ul>";
    for (const [key, value] of Object.entries(product.specs)) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      specsHTML += `<li><strong>${formattedKey}:</strong> ${value}</li>`;
    }
    specsHTML += "</ul>";
  }
  
  const bodyHTML = `<p>${product.description}</p>${specsHTML}`;
  const imageUrl = `${baseImageUrl.replace(/\/$/, '')}${product.image}`;

  // If product has sizes, generate variant row for each size
  const sizes = product.sizes || ["M"];
  
  sizes.forEach((size, index) => {
    const isFirst = index === 0;
    
    const row = {
      Handle: handle,
      // Core fields are only filled on the first row of the product
      Title: isFirst ? product.name : "",
      "Body (HTML)": isFirst ? bodyHTML : "",
      Vendor: isFirst ? "GLAZE" : "",
      "Product Category": "",
      Type: isFirst ? product.categoryLabel : "",
      Tags: isFirst ? tags : "",
      Published: "TRUE",
      "Option1 Name": "Size",
      "Option1 Value": size,
      "Variant SKU": `${product.id}-${size}`,
      "Variant Grams": "250",
      "Variant Inventory Tracker": "shopify",
      "Variant Inventory Qty": "100",
      "Variant Inventory Policy": "deny",
      "Variant Fulfillment Service": "manual",
      "Variant Price": product.price.toFixed(2),
      "Variant Requires Shipping": "TRUE",
      "Variant Taxable": "TRUE",
      // Images are associated with the first variant
      "Image Src": isFirst ? imageUrl : "",
      "Image Position": isFirst ? "1" : "",
      Status: "active"
    };

    const csvRow = HEADERS.map((header) => csvCell(row[header])).join(",");
    lines.push(csvRow);
  });
});

writeFileSync("shopify_import.csv", lines.join("\n"), "utf-8");
console.log(`\n========================================`);
console.log(`SUCCESS: Wrote shopify_import.csv`);
console.log(`Total Products: ${PRODUCTS.length}`);
console.log(`Total Rows (variants): ${lines.length - 1}`);
console.log(`Asset base URL prefix: ${baseImageUrl}`);
console.log(`========================================\n`);

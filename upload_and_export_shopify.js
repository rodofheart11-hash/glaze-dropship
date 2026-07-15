/**
 * GLAZE® Shopify Public Exporter (via Tmpfiles.org Direct Links)
 * 
 * Automatically uploads local product images to tmpfiles.org, retrieves direct,
 * restriction-free download links, and compiles a shopify_import.csv sheet.
 * 
 * Shopify's cloud crawlers can fetch these direct download URLs instantly.
 * Note: tmpfiles.org files are kept publicly active for 60 minutes, which is
 * plenty of time to run your Shopify Product Import.
 * 
 * Run:
 *   node upload_and_export_shopify.js
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PRODUCTS } from './src/products.js';

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

async function uploadToTmpfiles(localPath) {
  if (!existsSync(localPath)) {
    console.log(`  [WARN] File not found: ${localPath}`);
    return "";
  }
  
  try {
    const fileBuffer = readFileSync(localPath);
    const fileName = localPath.split('/').pop();
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      console.log(`  [ERR] Upload failed: HTTP ${res.status}`);
      return "";
    }
    
    const data = await res.json();
    if (data.status === 'success' && data.data && data.data.url) {
      const viewUrl = data.data.url;
      // Convert standard viewer link to direct download link
      const directUrl = viewUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
      return directUrl;
    } else {
      console.log(`  [ERR] Unexpected upload API response: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.log(`  [ERR] Exception uploading ${localPath}: ${e.message}`);
  }
  return "";
}

async function main() {
  console.log(`==================================================`);
  console.log(`Starting Public Upload Pipeline for Shopify Assets`);
  console.log(`==================================================`);
  
  // Find all unique images used in PRODUCTS
  const uniqueImages = [...new Set(PRODUCTS.map(p => p.image).filter(Boolean))];
  
  console.log(`Found ${uniqueImages.length} unique catalog images to host...`);
  
  // Upload images and build mapping
  const urlMap = {};
  for (const imgPath of uniqueImages) {
    const localPath = `./public${imgPath}`;
    console.log(`Uploading ${localPath}...`);
    const publicUrl = await uploadToTmpfiles(localPath);
    if (publicUrl) {
      console.log(`  -> Hosted URL: ${publicUrl}`);
      urlMap[imgPath] = publicUrl;
    } else {
      console.log(`  -> FAILED to host image.`);
    }
  }
  
  // Generate CSV rows
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
    
    // Map local image path to the uploaded public URL
    const imageUrl = urlMap[product.image] || "";
    
    const sizes = product.sizes || ["M"];
    
    sizes.forEach((size, index) => {
      const isFirst = index === 0;
      
      const row = {
        Handle: handle,
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
        "Image Src": isFirst ? imageUrl : "",
        "Image Position": isFirst ? "1" : "",
        Status: "active"
      };

      const csvRow = HEADERS.map((header) => csvCell(row[header])).join(",");
      lines.push(csvRow);
    });
  });
  
  writeFileSync("shopify_import.csv", lines.join("\n"), "utf-8");
  
  console.log(`\n==================================================`);
  console.log(`SUCCESS: Compiled shopify_import.csv`);
  console.log(`Total Products: ${PRODUCTS.length}`);
  console.log(`Total Rows (variants): ${lines.length - 1}`);
  console.log(`Note: Images are hosted publicly on tmpfiles.org direct links.`);
  console.log(`These links are valid for 60 minutes for import.`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("Critical failure running uploader script: ", err);
});

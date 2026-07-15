/**
 * Build a MINIMAL Shopify import CSV that updates existing products by handle:
 *   - attaches the GitHub-hosted image
 *   - assigns the category Collection
 *
 * Columns kept deliberately minimal — Handle, Title, Image Src, Image Position,
 * Collection — so Shopify treats each row as a product-level update and does
 * NOT expect variant option input.
 *
 * Join key for category = ASIN (reliable), via asin_collection.json.
 * Join key for Shopify product = Handle (= full title slug, matches Shopify).
 *
 * Output: shopify_image_update.csv
 */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';

const REPO_RAW =
  'https://raw.githubusercontent.com/rodofheart11-hash/aurea-product-images/main';

const slug = (t) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const csvCell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (q && text[i + 1] === '"') { cell += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !q) {
      if (cell !== '' || row.length) { row.push(cell); rows.push(row); row = []; cell = ''; }
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const src = parseCsv(readFileSync('amazon_bestsellers.csv', 'utf-8'));
const header = src[0];
const iAsin = header.indexOf('asin');
const iTitle = header.indexOf('title');
const collByAsin = JSON.parse(readFileSync('asin_collection.json', 'utf-8'));

// Option1 Name/Value = the default single-variant option Shopify expects.
// Including them prevents the "Product options input is required when updating
// variants" error on re-import.
const lines = [
  'Handle,Title,Option1 Name,Option1 Value,Collection,Image Src,Image Position',
];
let matched = 0, missing = 0;
for (let r = 1; r < src.length; r++) {
  const asin = (src[r][iAsin] || '').trim();
  const title = (src[r][iTitle] || '').trim();
  if (!asin || !title) continue;
  if (!existsSync(`product-images/${asin}.jpg`)) { missing++; continue; }
  const handle = slug(title);
  const collection = collByAsin[asin] || 'Jewelry';
  const url = `${REPO_RAW}/${asin}.jpg`;
  lines.push(
    `${csvCell(handle)},${csvCell(title)},Title,Default Title,${csvCell(collection)},${url},1`,
  );
  matched++;
}

writeFileSync('shopify_image_update.csv', lines.join('\n') + '\n', 'utf-8');
console.log(`Wrote shopify_image_update.csv — ${matched} products (images + collection), ${missing} skipped (no image).`);

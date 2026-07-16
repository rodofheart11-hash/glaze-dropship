/**
 * GLAZE — Shopify Admin API product sync
 * ---------------------------------------------------------------------------
 * Reconciles the LIVE products in your Shopify store with the honest catalog
 * in src/products.js:
 *   - UPDATES the 8 honest products (title, body_html, tags, product_type)
 *     to match the catalog, matched by handle (fallback: fuzzy title).
 *   - DELETES (or, by default, DRAFTS) any other GLAZE products still live
 *     from the old import — including the removed fake/branded items.
 *
 * SECURITY: credentials come ONLY from environment variables. Nothing is
 * hardcoded and the token is never printed.
 *
 * Required env vars:
 *   SHOPIFY_STORE   e.g. your-store.myshopify.com  (the *.myshopify.com admin domain)
 *   SHOPIFY_TOKEN   Admin API access token (shpat_...) from a custom app
 *
 * Usage:
 *   node shopify_sync.mjs                 # DRY RUN — prints the plan, changes nothing
 *   node shopify_sync.mjs --apply         # apply updates + DRAFT extras (safe, reversible)
 *   node shopify_sync.mjs --apply --delete # apply updates + permanently DELETE extras
 *
 * The 2024-10 REST Admin API is used. Product handles are matched to the
 * catalog by the handleized product name (same scheme the theme uses).
 */

import { PRODUCTS } from './src/products.js';

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_TOKEN;
const APPLY = process.argv.includes('--apply');
const DELETE = process.argv.includes('--delete');
const API_VERSION = '2024-10';

if (!STORE || !TOKEN) {
  console.error('\nMissing credentials. Set environment variables first:');
  console.error('  SHOPIFY_STORE = your-store.myshopify.com');
  console.error('  SHOPIFY_TOKEN = shpat_xxx (Admin API access token)\n');
  console.error('Then run:  node shopify_sync.mjs           (dry run)');
  console.error('           node shopify_sync.mjs --apply   (apply)\n');
  process.exit(1);
}

const BASE = `https://${STORE}/admin/api/${API_VERSION}`;
const HEADERS = { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' };

const handleize = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Build the honest catalog keyed by handle, with Shopify-ready fields.
const catalogByHandle = {};
for (const p of PRODUCTS) {
  const handle = handleize(p.name);
  const benefits = (p.benefits || []).map((b) => `<li>${b}</li>`).join('');
  const specs = Object.entries(p.specs || {})
    .map(([k, v]) => `<li><strong>${k.charAt(0).toUpperCase() + k.slice(1)}:</strong> ${v}</li>`)
    .join('');
  const proof = p.rankLabel
    ? `<p><strong>${p.rankLabel}</strong> · ${p.rating}★ from ${Number(p.reviewsCount).toLocaleString()} reviews.</p>`
    : `<p>${p.rating}★ from ${Number(p.reviewsCount).toLocaleString()} reviews.</p>`;
  const body_html =
    `<p>${p.hook || p.description}</p>${proof}` +
    `<h3>Why you'll love it</h3><ul>${benefits}</ul>` +
    `<h3>Details</h3><ul>${specs}</ul>`;
  catalogByHandle[handle] = {
    handle,
    title: p.name,
    body_html,
    product_type: p.categoryLabel || '',
    tags: (p.badges || []).join(', '),
  };
}
const honestHandles = new Set(Object.keys(catalogByHandle));

async function shopify(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  // Respect Shopify rate limits politely.
  const remaining = res.headers.get('X-Shopify-Shop-Api-Call-Limit');
  if (remaining && remaining.split('/').map(Number).reduce((a, b) => a / b) > 0.8) {
    await new Promise((r) => setTimeout(r, 600));
  }
  return res.status === 200 || res.status === 201 ? res.json() : {};
}

// Fetch ALL products (paginated via Link header cursor).
async function fetchAllProducts() {
  const out = [];
  let url = `/products.json?limit=250&fields=id,title,handle,product_type,status,vendor`;
  while (url) {
    const res = await fetch(`${BASE}${url}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`list products -> ${res.status}: ${await res.text()}`);
    const data = await res.json();
    out.push(...(data.products || []));
    const link = res.headers.get('Link') || '';
    const next = link.split(',').find((s) => s.includes('rel="next"'));
    const m = next && next.match(/<([^>]+)>/);
    url = m ? m[1].replace(BASE, '') : null;
  }
  return out;
}

function matchCatalog(product) {
  // Prefer handle match; fall back to a fuzzy title match on the core noun.
  if (catalogByHandle[product.handle]) return catalogByHandle[product.handle];
  const t = (product.title || '').toLowerCase();
  for (const h of honestHandles) {
    const c = catalogByHandle[h];
    const core = c.title.toLowerCase().replace(/^glaze\s+/, '');
    if (t.includes(core.split(' ').slice(0, 2).join(' '))) return c;
  }
  return null;
}

(async () => {
  console.log(`\nGLAZE Shopify sync  —  store: ${STORE}`);
  console.log(`Mode: ${APPLY ? (DELETE ? 'APPLY + DELETE extras' : 'APPLY + DRAFT extras') : 'DRY RUN (no changes)'}\n`);

  const live = await fetchAllProducts();
  const glaze = live.filter(
    (p) => (p.vendor || '').toUpperCase() === 'GLAZE' || (p.handle || '').startsWith('glaze') || /glaze/i.test(p.title)
  );
  console.log(`Found ${live.length} products (${glaze.length} look like GLAZE items).\n`);

  const toUpdate = [];
  const toRemove = [];
  const matchedHandles = new Set();

  for (const p of glaze) {
    const c = matchCatalog(p);
    if (c) {
      toUpdate.push({ product: p, catalog: c });
      matchedHandles.add(c.handle);
    } else {
      toRemove.push(p);
    }
  }
  const missing = [...honestHandles].filter((h) => !matchedHandles.has(h));

  console.log('== UPDATE (honest products found live) ==');
  toUpdate.forEach(({ product, catalog }) =>
    console.log(`  ✎ [${product.id}] "${product.title}"  ->  "${catalog.title}"  tags:[${catalog.tags}]`)
  );
  console.log(`\n== ${DELETE ? 'DELETE' : 'DRAFT (hide)'} (not in honest catalog) ==`);
  toRemove.forEach((p) => console.log(`  ✖ [${p.id}] "${p.title}"  (${p.handle})`));
  if (missing.length) {
    console.log('\n== MISSING (in catalog but not found live — import these) ==');
    missing.forEach((h) => console.log(`  + ${catalogByHandle[h].title}  (handle: ${h})`));
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to update + draft, or --apply --delete to remove extras.\n');
    return;
  }

  console.log('\nApplying changes...');
  for (const { product, catalog } of toUpdate) {
    await shopify(`/products/${product.id}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        product: {
          id: product.id,
          title: catalog.title,
          body_html: catalog.body_html,
          product_type: catalog.product_type,
          tags: catalog.tags,
        },
      }),
    });
    console.log(`  ✓ updated ${catalog.title}`);
  }
  for (const p of toRemove) {
    if (DELETE) {
      await shopify(`/products/${p.id}.json`, { method: 'DELETE' });
      console.log(`  ✓ deleted ${p.title}`);
    } else {
      await shopify(`/products/${p.id}.json`, {
        method: 'PUT',
        body: JSON.stringify({ product: { id: p.id, status: 'draft' } }),
      });
      console.log(`  ✓ drafted (hidden) ${p.title}`);
    }
  }
  console.log('\nDone. Reload your store to verify.\n');
})().catch((e) => {
  console.error('\nSync failed:', e.message, '\n');
  process.exit(1);
});

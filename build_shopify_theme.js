/**
 * GLAZE Shopify Section Compiler
 * 
 * Automatically compiles index.html, src/style.css, and src/main.js into a single,
 * drag-and-drop Shopify Custom Section: shopify-theme/sections/glaze-storefront.liquid.
 * 
 * It automatically:
 *   1. Integrates Shopify Liquid syntax to pull products from collections.
 *   2. Connects the glassmorphic cart directly to Shopify's AJAX Cart API and /checkout.
 *   3. Packages all CSS and JS inline for a zero-configuration installation.
 * 
 * Run: node build_shopify_theme.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCTS as CATALOG, TOTAL_REVIEWS } from './src/products.js';

// Build a keyed enrichment map so the LIVE Shopify Liquid products (which don't
// carry our custom merchandising fields) get the real rating, reviewsCount,
// hook, benefits, badges and rankLabel merged in by product handle/id at runtime.
// Keyed by handle AND by the raw title (handleized) so we can match regardless
// of how the product was imported.
const enrichmentMap = {};
CATALOG.forEach(p => {
  const entry = {
    rating: p.rating,
    reviewsCount: p.reviewsCount,
    hook: p.hook || "",
    rankLabel: p.rankLabel || "",
    badges: p.badges || [],
    benefits: p.benefits || [],
    specs: p.specs || {},
    categoryLabel: p.categoryLabel || ""
  };
  // Key by a handleized version of the product name so it matches Shopify's handle.
  const handleKey = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  enrichmentMap[handleKey] = entry;
  // Also key by the source ASIN id for a secondary match.
  enrichmentMap[p.id] = entry;
});
const enrichmentJSON = JSON.stringify(enrichmentMap);
const totalReviewsRounded = Math.floor(TOTAL_REVIEWS / 1000) * 1000; // "70,000+" honest floor

// Hosted image URLs (by source id) used by the static fallback catalog.
const FALLBACK_IMAGES = {
  B0FT4QF9D5: "https://files.catbox.moe/rabxm9.jpg",
  B0CSDK2C3P: "https://files.catbox.moe/17e114.jpg",
  B0BV241H3F: "https://files.catbox.moe/h64bqu.jpg",
  B09P3RHNSY: "https://files.catbox.moe/oms6xl.jpg",
  B09MKNL9M3: "https://files.catbox.moe/r4s2lf.jpg",
  B0CKZ4ZWYG: "https://files.catbox.moe/rrpwrx.jpg",
  B0FP5BYXVR: "https://files.catbox.moe/ivmew0.jpg",
  B0FTSVKP9B: "https://files.catbox.moe/u8xrnb.jpg"
};
// Build the static fallback array from the catalog (kept in sync automatically).
const fallbackArray = CATALOG.map(p => ({
  id: p.id,
  name: p.name,
  category: p.category,
  categoryLabel: p.categoryLabel,
  price: p.price,
  rating: p.rating,
  reviewsCount: p.reviewsCount,
  image: FALLBACK_IMAGES[p.id] || p.image,
  hook: p.hook || "",
  rankLabel: p.rankLabel || "",
  badges: p.badges || [],
  benefits: p.benefits || [],
  description: p.description,
  specs: p.specs || {},
  sizes: p.sizes || [],
  variantsMap: { [ (p.sizes && p.sizes[0]) || "M" ]: "1" }
}));
const fallbackArrayJSON = JSON.stringify(fallbackArray, null, 2);

const themeDirs = [
  './temp-shopify-theme/sections',
  './temp-shopify-theme/layout',
  './temp-shopify-theme/templates',
  './temp-shopify-theme/config'
];

themeDirs.forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// 1. Read input files
const indexHTML = readFileSync('index.html', 'utf-8');
const styleCSS = readFileSync('src/style.css', 'utf-8');
const mainJS = readFileSync('src/main.js', 'utf-8');

// 2. Extract Body markup from index.html (excluding script imports of main.js)
const bodyRegex = /<body[^>]*>([\s\S]*)<\/body>/;
const bodyMatch = indexHTML.match(bodyRegex);
let bodyContent = bodyMatch ? bodyMatch[1] : '';

// Remove the local main.js script tag if it exists in the body
bodyContent = bodyContent.replace(/<script[^>]*src=["']\/src\/main\.js["'][^>]*>[\s\S]*?<\/script>/gi, '');
// Remove static grid items from index.html since we will render them dynamically via Liquid!
const productGridRegex = /(<div[^>]*id=["']product-grid["'][^>]*>)([\s\S]*?)(<\/div>)/i;
bodyContent = bodyContent.replace(productGridRegex, '$1\n      {% comment %} Dynamic products rendered by Shopify Liquid {% endcomment %}\n      $3');

// 3. Build the Shopify JavaScript Cart Integration
// Instead of a local in-memory array, we sync directly with Shopify Cart AJAX!
const shopifyJS = `
/* ==========================================================================
   GLAZE Liquid Glass - Shopify AJAX Cart Integration
   (Liquid Glass = visual/glassmorphic design theme only)
   ========================================================================== */

// --- Shopify Dynamic Products Config ---
// This extracts the active collection products mapped directly in Liquid!
// Merchandising enrichment (real ratings, reviews, hooks, badges, benefits,
// bestseller ranks) keyed by product handle / source id. Merged onto the live
// Shopify products below so the real store shows genuine social proof.
const ENRICHMENT = ${enrichmentJSON};

let PRODUCTS = [
  {% for product in collection.products %}
  {
    id: "{{ product.id }}",
    handle: "{{ product.handle }}",
    name: "{{ product.title | escape }}",
    category: "{{ product.type | handleize }}",
    categoryLabel: "{{ product.type | escape }}",
    price: {{ product.price | divided_by: 100.0 }},
    available: {% if product.available %}true{% else %}false{% endif %},
    image: "{% if product.featured_image %}{{ product.featured_image | image_url: width: 800 }}{% else %}https://files.catbox.moe/hgn95m.jpg{% endif %}",
    description: "{{ product.description | escape | strip_newlines }}",
    specs: {},
    sizes: [
      {% for variant in product.variants %}
        "{{ variant.title | escape }}"{% unless forloop.last %},{% endunless %}
      {% endfor %}
    ],
    variantsMap: {
      {% for variant in product.variants %}
        "{{ variant.title | escape }}": "{{ variant.id }}"{% unless forloop.last %},{% endunless %}
      {% endfor %}
    }
  }{% unless forloop.last %},{% endunless %}
  {% endfor %}
];

// Merge merchandising enrichment onto each live product (match by handle, then id).
PRODUCTS.forEach(product => {
  const e = ENRICHMENT[product.handle] || ENRICHMENT[product.id] || null;
  if (e) {
    product.rating = e.rating;
    product.reviewsCount = e.reviewsCount;
    product.hook = e.hook;
    product.rankLabel = e.rankLabel;
    product.badges = e.badges;
    product.benefits = e.benefits;
    if (e.specs && Object.keys(e.specs).length) product.specs = e.specs;
    if (e.categoryLabel) product.categoryLabel = e.categoryLabel;
  }
  // Sensible fallbacks so the UI never breaks on an unmatched product.
  if (product.rating == null) product.rating = 4.6;
  if (product.reviewsCount == null) product.reviewsCount = 0;
  if (!product.badges) product.badges = product.available ? ["New"] : ["Sold Out"];
  if (!product.benefits) product.benefits = [];
  if (product.hook == null) product.hook = "";
  if (product.rankLabel == null) product.rankLabel = "";
});

// Bestsellers first: order by review count so the most-proven items lead.
PRODUCTS.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));

// Post-process: clean the Shopify description into plain prose, and (only as a
// fallback, when enrichment didn't supply them) parse specs from the description.
PRODUCTS.forEach(product => {
  if (product.description && /<[a-z]/i.test(product.description)) {
    try {
      const txt = document.createElement("textarea");
      txt.innerHTML = product.description;
      const rawHtml = txt.value;

      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');

      // Fallback spec extraction only if enrichment gave us nothing.
      if (!product.specs || Object.keys(product.specs).length === 0) {
        product.specs = product.specs || {};
        doc.querySelectorAll('li').forEach(li => {
          const strong = li.querySelector('strong');
          if (strong) {
            const key = strong.textContent.replace(':', '').trim();
            const value = li.textContent.replace(strong.textContent, '').trim();
            product.specs[key] = value;
          }
        });
      }

      // Use just the intro paragraph(s) as the prose description.
      const pElements = doc.querySelectorAll('p');
      if (pElements.length > 0) {
        product.description = Array.from(pElements).map(p => p.textContent.trim()).join(' ');
      } else {
        product.description = (doc.body.textContent || '').trim();
      }
    } catch (e) {
      console.error("Failed to parse product description:", e);
    }
  }
});

// Fallback to static catalog if Shopify returns 0 products (collection not configured yet).
// Generated from src/products.js (single source of truth) with the real image URLs.
if (PRODUCTS.length === 0) {
  PRODUCTS = ${fallbackArrayJSON};
}

let cart = [];
let activeCategory = "all";
let activeModalProduct = null;

// --- App router state ---
const VIEWS = { home: "view-home", product: "view-product", bag: "view-bag", search: "view-search" };
const VIEW_TITLES = { home: "", product: "", bag: "Shopping Bag", search: "Search" };
let viewStack = ["home"];
let searchQuery = "";
let isAnimating = false;

// --- DOM Elements ---
const productGrid = document.getElementById("product-grid");
const searchGrid = document.getElementById("search-product-grid");
const filterTabs = document.querySelectorAll("#catalog .filter-tab");
const searchFilterTabs = document.querySelectorAll("#search-filter-tabs .filter-tab");
const searchInput = document.getElementById("search-input");
const cartBtn = document.getElementById("cart-btn");
const cartBadge = document.querySelector(".app-bar .cart-badge");
const tabCartBadge = document.querySelector(".tab-cart-badge");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotalVal = document.getElementById("cart-subtotal-value");
const checkoutBtn = document.getElementById("checkout-btn");
const productViewBody = document.getElementById("product-view-body");
const appBar = document.getElementById("app-bar");
const appBarBack = document.getElementById("app-bar-back");
const appBarTitle = document.getElementById("app-bar-title");
const viewStackEl = document.getElementById("view-stack");
const tabBar = document.getElementById("tab-bar");
const searchBtn = document.getElementById("search-btn");
const checkoutSuccessModal = document.getElementById("checkout-success-modal");
const successCloseBtn = document.getElementById("success-close-btn");
const orderRefCode = document.getElementById("order-ref-code");
const toastContainer = document.getElementById("toast-container");
const newsletterForm = document.getElementById("newsletter-form");

// --- Initialization ---
function initGlaze() {
    // On (re-)init (incl. Shopify theme editor section reload) reset to Home root.
    viewStack = ["home"];
    resetViewsToHome();
    renderProducts();
    setupEventListeners();
    initRouter();
    syncShopifyCart();
    if (window.AYSzvothEK) {
        window.AYSzvothEK.track('page_viewed');
    }
}

// Run immediately as elements are already loaded in the DOM
initGlaze();

// Fallbacks for standard page loads and Shopify theme editor updates
document.addEventListener("DOMContentLoaded", initGlaze);
document.addEventListener("shopify:section:load", initGlaze);

// --- Event Listeners Setup ---
function setupEventListeners() {
    if (window.glazeListenersAttached) return;
    window.glazeListenersAttached = true;

    // Home category filtering
    filterTabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            filterTabs.forEach(t => t.classList.remove("active"));
            e.currentTarget.classList.add("active");
            activeCategory = e.currentTarget.getAttribute("data-category");
            renderProducts();
            if (window.AYSzvothEK) {
                window.AYSzvothEK.track('collection_viewed', { category: activeCategory });
            }
            if (window.Shopify && window.Shopify.analytics) {
                window.Shopify.analytics.publish('custom_collection_viewed', { category: activeCategory });
            }
        });
    });

    // Checkout Action -> verify the real Shopify cart has items, then redirect.
    checkoutBtn.addEventListener("click", () => {
        checkoutBtn.disabled = true;
        // Re-check the authoritative Shopify cart right before sending to checkout,
        // so we never redirect the buyer to an empty /checkout.
        fetch('/cart.js')
            .then(res => res.json())
            .then(data => {
                if (!data || data.item_count === 0) {
                    checkoutBtn.disabled = false;
                    showToast("Your bag is empty. Add an item before checking out.", "fa-circle-exclamation");
                    return;
                }
                if (window.AYSzvothEK) {
                    window.AYSzvothEK.track('checkout_started');
                }
                window.location.href = '/checkout';
            })
            .catch(() => {
                checkoutBtn.disabled = false;
                showToast("Couldn't reach checkout. Please try again.", "fa-circle-exclamation");
            });
    });

    // Success Modal Close
    if (successCloseBtn) {
        successCloseBtn.addEventListener("click", () => {
            checkoutSuccessModal.classList.remove("active");
        });
    }

    // Newsletter Submission
    if (newsletterForm) {
        newsletterForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const emailInput = newsletterForm.querySelector("input");
            showToast(\`Successfully subscribed: \${emailInput.value}!\`, "fa-circle-check");
            emailInput.value = "";
        });
    }
}

/* ==========================================================================
   APP ROUTER — full-screen stacked views with iOS-style slide push/pop
   ========================================================================== */

function getViewEl(name) { return document.getElementById(VIEWS[name]); }

function resetViewsToHome() {
    Object.keys(VIEWS).forEach(name => {
        const el = getViewEl(name);
        if (!el) return;
        el.classList.remove("view-active", "view-exit-left", "view-exit-right", "is-animating");
        if (name === "home") {
            el.classList.remove("is-hidden");
            el.setAttribute("aria-hidden", "false");
        } else {
            el.classList.add("is-hidden");
            el.setAttribute("aria-hidden", "true");
        }
    });
    updateAppBar();
}

function updateAppBar() {
    const top = viewStack[viewStack.length - 1];
    if (appBarBack) appBarBack.hidden = viewStack.length <= 1;
    if (appBarTitle) {
        if (top === "home") {
            appBarTitle.innerHTML = '<span class="logo"><span class="logo-accent">GLA</span>ZE</span>';
        } else if (top === "product" && activeModalProduct) {
            appBarTitle.textContent = activeModalProduct.name;
        } else if (top === "bag") {
            const count = cart.reduce((s, i) => s + i.quantity, 0);
            appBarTitle.textContent = count > 0 ? \`Shopping Bag (\${count})\` : "Shopping Bag";
        } else {
            appBarTitle.textContent = VIEW_TITLES[top] || "";
        }
    }
    // Sync bottom tab + desktop nav active state to the current root-ish view.
    const tabName = (top === "product") ? "home" : top;
    if (tabBar) {
        tabBar.querySelectorAll(".tab-item").forEach(t => {
            t.classList.toggle("active", t.getAttribute("data-tab") === tabName);
        });
    }
    document.querySelectorAll("#app-bar-nav .nav-link").forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-tab") === tabName);
    });
}

// Build a view's content just before it becomes visible.
function buildView(name, data) {
    if (name === "product" && data) renderProductView(data);
    else if (name === "bag") syncShopifyCart();
    else if (name === "search") renderSearch();
}

function finishAnimation(cb) {
    // transitionend + a safety timeout so state never gets stuck.
    let done = false;
    const finalize = () => { if (done) return; done = true; cb(); };
    return { finalize };
}

// Push a new view onto the stack (records history).
function pushView(name, data) {
    if (isAnimating) return;
    const fromName = viewStack[viewStack.length - 1];
    if (name === "product") activeModalProduct = data || null;
    buildView(name, data);

    const fromEl = getViewEl(fromName);
    const toEl = getViewEl(name);
    if (!toEl) return;

    isAnimating = true;
    // Prepare incoming view off-screen to the right.
    toEl.classList.remove("is-hidden", "view-exit-left", "view-exit-right");
    toEl.setAttribute("aria-hidden", "false");
    toEl.style.transform = "translateX(100%)";
    // Reset incoming scroll to top.
    const sc = toEl.querySelector(".view-scroll");
    if (sc) sc.scrollTop = 0;
    // Force reflow so the transform takes effect before we animate.
    void toEl.offsetWidth;

    toEl.classList.add("is-animating");
    if (fromEl) fromEl.classList.add("is-animating");

    toEl.style.transform = "";
    toEl.classList.add("view-active");
    if (fromEl) fromEl.classList.add("view-exit-left");

    const { finalize } = finishAnimation(() => {
        if (fromEl) fromEl.classList.remove("is-animating");
        toEl.classList.remove("is-animating");
    });
    const onEnd = () => { toEl.removeEventListener("transitionend", onEnd); finalize(); isAnimating = false; };
    toEl.addEventListener("transitionend", onEnd);
    setTimeout(() => { finalize(); isAnimating = false; }, 500);

    viewStack.push(name);
    updateAppBar();
    history.pushState({ view: name }, "");

    // Analytics parity with the old overlays.
    if (name === "bag") {
        if (window.AYSzvothEK) window.AYSzvothEK.track('cart_viewed');
        if (window.Shopify && window.Shopify.analytics) window.Shopify.analytics.publish('custom_cart_viewed', {});
    }
}

// Pop the top view (driven by popstate only).
function popView() {
    if (viewStack.length <= 1) return;
    if (isAnimating) return;
    const fromName = viewStack[viewStack.length - 1];
    const toName = viewStack[viewStack.length - 2];
    const fromEl = getViewEl(fromName);
    const toEl = getViewEl(toName);
    if (!fromEl || !toEl) return;

    isAnimating = true;
    // Incoming (previous) view sits dimmed to the left; bring it back to 0.
    toEl.classList.remove("is-hidden", "view-exit-left");
    toEl.setAttribute("aria-hidden", "false");
    void toEl.offsetWidth;
    toEl.classList.add("is-animating");
    fromEl.classList.add("is-animating");

    toEl.classList.remove("view-exit-left");
    toEl.classList.add("view-active");
    fromEl.classList.remove("view-active");
    fromEl.classList.add("view-exit-right");

    const cleanup = () => {
        fromEl.removeEventListener("transitionend", cleanup);
        fromEl.classList.add("is-hidden");
        fromEl.classList.remove("view-exit-right", "is-animating", "view-active");
        fromEl.setAttribute("aria-hidden", "true");
        toEl.classList.remove("is-animating");
        if (toName === "home") toEl.classList.remove("view-active"); // home rests at translateX(0)
        isAnimating = false;
    };
    fromEl.addEventListener("transitionend", cleanup);
    setTimeout(cleanup, 500);

    viewStack.pop();
    if (fromName === "product") activeModalProduct = null;
    updateAppBar();
}

// Bottom tab switch: reset the stack to a single view (cross-fade / instant swap).
function switchTab(name) {
    if (isAnimating) return;
    const top = viewStack[viewStack.length - 1];
    if (top === name) {
        // Tapping the current tab: if we're deep in a stack, pop to root.
        if (viewStack.length > 1) { history.go(-(viewStack.length - 1)); }
        return;
    }
    buildView(name, null);
    // Collapse history back to a single entry, then swap instantly.
    if (viewStack.length > 1) { history.go(-(viewStack.length - 1)); }
    // Defer the swap so the popstate unwinding settles first.
    setTimeout(() => {
        viewStack = [name];
        Object.keys(VIEWS).forEach(v => {
            const el = getViewEl(v);
            if (!el) return;
            el.classList.remove("view-active", "view-exit-left", "view-exit-right", "is-animating");
            if (v === name) {
                el.classList.remove("is-hidden");
                el.setAttribute("aria-hidden", "false");
                el.style.transform = (v === "home") ? "" : "translateX(0)";
                if (v !== "home") el.classList.add("view-active");
                const sc = el.querySelector(".view-scroll");
                if (sc) sc.scrollTop = 0;
            } else {
                el.classList.add("is-hidden");
                el.setAttribute("aria-hidden", "true");
                el.style.transform = "";
            }
        });
        history.replaceState({ view: name }, "");
        updateAppBar();
    }, isAnimating ? 60 : 0);
}

function initRouter() {
    if (window.glazeRouterInit) return;
    window.glazeRouterInit = true;

    history.replaceState({ view: "home" }, "");

    window.addEventListener("popstate", () => {
        if (viewStack.length > 1) popView();
    });

    if (appBarBack) appBarBack.addEventListener("click", () => history.back());
    if (searchBtn) searchBtn.addEventListener("click", () => switchTab("search"));
    if (cartBtn) cartBtn.addEventListener("click", () => {
        if (viewStack[viewStack.length - 1] !== "bag") pushView("bag");
    });

    if (tabBar) {
        tabBar.querySelectorAll(".tab-item").forEach(tab => {
            tab.addEventListener("click", () => switchTab(tab.getAttribute("data-tab")));
        });
    }

    // Desktop top-nav links (shown at >=1024px) drive the same router.
    document.querySelectorAll("#app-bar-nav .nav-link").forEach(link => {
        link.addEventListener("click", () => switchTab(link.getAttribute("data-tab")));
    });

    // Search wiring
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = (e.target.value || "").toLowerCase().trim();
            renderSearch();
        });
    }
    searchFilterTabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            searchFilterTabs.forEach(t => t.classList.remove("active"));
            e.currentTarget.classList.add("active");
            activeCategory = e.currentTarget.getAttribute("data-category");
            renderSearch();
        });
    });
}

// Render the search results grid (name + category filter).
function renderSearch() {
    if (!searchGrid) return;
    let list = activeCategory === "all" ? PRODUCTS : PRODUCTS.filter(p => p.category === activeCategory);
    if (searchQuery) {
        list = list.filter(p => (p.name || "").toLowerCase().includes(searchQuery)
            || (p.hook || "").toLowerCase().includes(searchQuery)
            || (p.categoryLabel || "").toLowerCase().includes(searchQuery));
    }
    renderProducts(searchGrid, list);
}

// --- Sync with Shopify Cart (AJAX) ---
function syncShopifyCart() {
    fetch('/cart.js')
        .then(res => res.json())
        .then(data => {
            // Map Shopify Cart Items into our localized format
            cart = data.items.map(item => {
                // Find matching product in our local list
                const matchedProduct = PRODUCTS.find(p => p.name === item.product_title) || {
                    id: item.product_id,
                    name: item.product_title,
                    price: item.price / 100,
                    image: item.image
                };
                return {
                    product: matchedProduct,
                    size: item.variant_options ? item.variant_options[0] : "Default",
                    quantity: item.quantity,
                    key: item.key,
                    variantId: item.id
                };
            });
            updateCartUI(data.total_price / 100, data.item_count);
        })
        .catch(err => console.error("Error syncing Shopify cart:", err));
}

// --- Render star icons for a 0-5 rating ---
function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(r);
    const half = (r - full) >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    let html = "";
    for (let i = 0; i < full; i++) html += '<i class="fa-solid fa-star"></i>';
    if (half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    for (let i = 0; i < empty; i++) html += '<i class="fa-regular fa-star"></i>';
    return html;
}

// --- Render Product Grid (into a target grid; optional pre-filtered list) ---
function renderProducts(gridEl, list) {
    gridEl = gridEl || productGrid;
    if (!gridEl) return;
    gridEl.innerHTML = "";

    const filtered = list || (activeCategory === "all"
        ? PRODUCTS
        : PRODUCTS.filter(p => p.category === activeCategory));

    if (filtered.length === 0) {
        gridEl.innerHTML = \`<div class="empty-message">No items found.</div>\`;
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.setAttribute("data-id", product.id);

        const rankBadge = product.rankLabel
            ? \`<div class="product-rank-badge"><i class="fa-solid fa-award"></i> \${product.rankLabel}</div>\`
            : (product.badges && product.badges[0] ? \`<div class="product-rank-badge alt">\${product.badges[0]}</div>\` : "");
        const chipsHTML = (product.badges || []).slice(0, 3).map(b =>
            \`<span class="product-chip">\${b}</span>\`).join("");

        card.innerHTML = \`
            <div class="product-img-wrapper">
                <div class="glass-reflection-shine"></div>
                <img src="\${product.image}" alt="\${product.name}" class="product-img" loading="lazy">
                \${rankBadge}
            </div>
            <div class="product-info">
                <div class="product-rating">
                    <span class="stars-inline">\${renderStars(product.rating)}</span>
                    <span class="rating-count"><strong>\${product.rating}</strong> · \${Number(product.reviewsCount).toLocaleString()} reviews</span>
                </div>
                <h3 class="product-name">\${product.name}</h3>
                \${product.hook ? \`<p class="product-hook">\${product.hook}</p>\` : ""}
                <div class="product-chips">\${chipsHTML}</div>
                <div class="product-price-row">
                    <span class="product-price">\$\${product.price.toFixed(2)}</span>
                    <button class="btn-add-cart" title="Add to Bag">
                        <i class="fa-solid fa-bag-shopping"></i> Add
                    </button>
                </div>
            </div>
        \`;

        // Bind add to cart
        card.querySelector(".btn-add-cart").addEventListener("click", (e) => {
            e.stopPropagation();
            const defaultSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : "M";
            addToCart(product, defaultSize);
        });

        // Bind open full-screen product view on card click
        card.addEventListener("click", () => {
            pushView("product", product);
        });

        gridEl.appendChild(card);
    });
}

// --- Add Item to Shopify Cart (AJAX) ---
function addToCart(product, size) {
    if (window.AYSzvothEK) {
        window.AYSzvothEK.track('AddToCart', {
            id: product.id,
            name: product.name,
            price: product.price,
            size: size
        });
    }
    const variantId = product.variantsMap ? product.variantsMap[size] : null;

    // A valid Shopify variant ID is a long numeric string. If we don't have one,
    // the product isn't properly wired to Shopify (collection not set / not imported).
    // NEVER fake a successful add — that sends buyers to an empty checkout.
    const isValidVariant = variantId && /^\\d{6,}$/.test(String(variantId));

    if (!isValidVariant) {
        console.error("No valid Shopify variant ID for", product.name, size, "-> got:", variantId);
        showToast("Sorry, this item can't be added right now.", "fa-circle-exclamation");
        return;
    }

    showToast("Adding " + product.name + " (" + size + ") to bag...", "fa-spinner");

    fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: [{ id: variantId, quantity: 1 }]
        })
    })
    .then(res => {
        if (!res.ok) throw new Error("Shopify rejected cart add");
        return res.json();
    })
    .then(() => {
        showToast("Added " + product.name + " to bag!", "fa-bag-shopping");
        syncShopifyCart();
    })
    .catch(err => {
        console.error("Cart add error: ", err);
        showToast("Couldn't add to bag. It may be out of stock.", "fa-circle-exclamation");
    });
}

// --- Modify Variant Quantity in Shopify Cart (AJAX) ---
function changeQuantity(lineKey, newQty) {
    // Update the authoritative Shopify cart by line key (from /cart.js).
    fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: String(lineKey),
            quantity: Math.max(0, newQty)
        })
    })
    .then(res => res.json())
    .then(() => {
        syncShopifyCart();
    })
    .catch(err => console.error("Error updating quantity: ", err));
}

// --- Render Cart UI ---
function updateCartUI(totalPrice = 0, itemCount = 0) {
    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = \`
            <div class="cart-empty-message">
                <i class="fa-solid fa-bag-shopping"></i>
                <p>Your bag is empty.</p>
                <button class="btn btn-secondary close-cart-btn-action" style="font-size:0.85rem; padding:10px 20px;">Browse Collection</button>
            </div>
        \`;

        const browseBtn = cartItemsContainer.querySelector(".close-cart-btn-action");
        if (browseBtn) {
            browseBtn.addEventListener("click", () => switchTab("home"));
        }

        setCartBadges(0);
        cartSubtotalVal.innerText = "$0.00";
        checkoutBtn.disabled = true;
        if (viewStack[viewStack.length - 1] === "bag") updateAppBar();
        return;
    }

    cart.forEach((item) => {
        const cartItemEl = document.createElement("div");
        cartItemEl.className = "cart-item";
        cartItemEl.innerHTML = \`
            <div class="cart-item-img-wrapper">
                <img src="\${item.product.image}" alt="\${item.product.name}">
            </div>
            <div class="cart-item-info">
                <h4 class="cart-item-name">\${item.product.name}</h4>
                <span class="cart-item-size">Size: \${item.size}</span>
                <span class="cart-item-price">\$\${item.product.price.toFixed(2)}</span>
                <div class="cart-item-actions">
                    <div class="qty-controls">
                        <button class="qty-btn dec-qty-btn">-</button>
                        <span class="qty-val">\${item.quantity}</span>
                        <button class="qty-btn inc-qty-btn">+</button>
                    </div>
                    <button class="btn-remove-item" title="Remove Item">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        \`;

        // Use the Shopify line key (set by syncShopifyCart) for all changes.
        const lineRef = item.key || item.variantId;

        // Handle quantity decrement
        cartItemEl.querySelector(".dec-qty-btn").addEventListener("click", () => {
            changeQuantity(lineRef, item.quantity - 1);
        });

        // Handle quantity increment
        cartItemEl.querySelector(".inc-qty-btn").addEventListener("click", () => {
            changeQuantity(lineRef, item.quantity + 1);
        });

        // Handle deletion
        cartItemEl.querySelector(".btn-remove-item").addEventListener("click", () => {
            changeQuantity(lineRef, 0);
        });

        cartItemsContainer.appendChild(cartItemEl);
    });

    // Update Badge & Totals
    setCartBadges(itemCount);
    cartSubtotalVal.innerText = \`\$\${totalPrice.toFixed(2)}\`;
    checkoutBtn.disabled = false;
    if (viewStack[viewStack.length - 1] === "bag") updateAppBar();
}

// Sync both the app-bar cart badge and the bottom-tab bag badge.
function setCartBadges(count) {
    if (cartBadge) {
        cartBadge.innerText = count;
        cartBadge.classList.toggle("active", count > 0);
        cartBadge.style.display = count > 0 ? "flex" : "none";
    }
    if (tabCartBadge) {
        tabCartBadge.innerText = count;
        tabCartBadge.classList.toggle("active", count > 0);
    }
}

// --- Full-screen Product View ---
function renderProductView(product) {
    if (!productViewBody) return;
    if (window.AYSzvothEK) {
        window.AYSzvothEK.track('product_viewed', {
            id: product.id,
            name: product.name,
            price: product.price
        });
    }
    if (window.Shopify && window.Shopify.analytics) {
        window.Shopify.analytics.publish('custom_product_viewed', {
            id: product.id,
            name: product.name,
            price: product.price
        });
    }
    activeModalProduct = product;
    
    // Format specifications
    let specsHTML = "";
    if (product.specs) {
        specsHTML = \`<div class="specs-grid">\`;
        for (const [key, value] of Object.entries(product.specs)) {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            specsHTML += \`
                <div class="spec-item">
                    <span class="spec-label">\${label}</span>
                    <span class="spec-val">\${value}</span>
                </div>
            \`;
        }
        specsHTML += \`</div>\`;
    }

    // Format sizes buttons
    let sizesHTML = "";
    if (product.sizes) {
        product.sizes.forEach((size, idx) => {
            sizesHTML += \`
                <button class="size-btn \${idx === 0 ? 'active' : ''}" data-size="\${size}">\${size}</button>
            \`;
        });
    }

    // Benefit bullets (what you GET) — the primary selling content.
    let benefitsHTML = "";
    if (product.benefits && product.benefits.length) {
        benefitsHTML = \`<ul class="modal-benefits">\` +
            product.benefits.map(b => \`<li><i class="fa-solid fa-check"></i> \${b}</li>\`).join("") +
            \`</ul>\`;
    }

    // Rank ribbon (real bestseller rank) sits above the title as top proof.
    const rankRibbon = product.rankLabel
        ? \`<div class="modal-rank"><i class="fa-solid fa-award"></i> \${product.rankLabel}</div>\` : "";

    productViewBody.innerHTML = \`
        <div class="modal-img-wrapper glass-card">
            <div class="glass-reflection-shine"></div>
            <img src="\${product.image}" alt="\${product.name}" class="modal-product-img">
        </div>
        <div class="modal-details">
            <span class="modal-category">\${product.categoryLabel}</span>
            \${rankRibbon}
            <h2 class="modal-product-name">\${product.name}</h2>
            <div class="modal-rating-row">
                <div class="stars">\${renderStars(product.rating)}</div>
                <span class="reviews-count"><strong>\${product.rating}</strong> · \${Number(product.reviewsCount).toLocaleString()} reviews</span>
            </div>
            \${product.hook ? \`<p class="modal-hook">\${product.hook}</p>\` : ""}
            <span class="modal-product-price">\$\${product.price.toFixed(2)}</span>
            \${benefitsHTML}

            <div style="margin: 20px 0;">
                <div class="size-head">
                    <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">Select Size</h4>
                    <button type="button" class="size-guide-toggle"><i class="fa-solid fa-ruler"></i> Size guide</button>
                </div>
                <div class="size-selector">
                    \${sizesHTML}
                </div>
                <div class="size-guide-panel" hidden>
                    <table class="size-guide-table">
                        <thead>
                            <tr><th>Size</th><th>US</th><th>Bust (in)</th><th>Waist (in)</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>XS</td><td>0-2</td><td>31-32</td><td>24-25</td></tr>
                            <tr><td>S</td><td>4-6</td><td>33-34</td><td>26-27</td></tr>
                            <tr><td>M</td><td>8-10</td><td>35-37</td><td>28-30</td></tr>
                            <tr><td>L</td><td>12-14</td><td>38-40</td><td>31-33</td></tr>
                            <tr><td>XL</td><td>16-18</td><td>41-43</td><td>34-36</td></tr>
                        </tbody>
                    </table>
                    <p class="size-guide-note">Measurements are approximate. If you're between sizes, we suggest sizing up.</p>
                </div>
            </div>

            \${product.description ? \`<p class="modal-product-desc">\${product.description}</p>\` : ""}

            \${specsHTML}

            <button class="btn btn-primary modal-add-to-bag-btn">
                <i class="fa-solid fa-bag-shopping"></i> Add To Bag · \$\${product.price.toFixed(2)}
            </button>

            <div class="trust-badges">
                <div class="trust-badge"><i class="fa-solid fa-truck-fast"></i><span>Free worldwide shipping</span></div>
                <div class="trust-badge"><i class="fa-solid fa-rotate-left"></i><span>30-day easy returns</span></div>
                <div class="trust-badge"><i class="fa-solid fa-lock"></i><span>Secure checkout</span></div>
            </div>
        </div>
    \`;

    // Size Guide Toggle
    const sizeGuideToggle = productViewBody.querySelector(".size-guide-toggle");
    const sizeGuidePanel = productViewBody.querySelector(".size-guide-panel");
    if (sizeGuideToggle && sizeGuidePanel) {
        sizeGuideToggle.addEventListener("click", () => {
            sizeGuidePanel.hidden = !sizeGuidePanel.hidden;
        });
    }

    // Size Selection Handlers
    const sizeBtns = productViewBody.querySelectorAll(".size-btn");
    sizeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            sizeBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
        });
    });

    // Add To Bag — stay on the product view so the buyer can keep browsing.
    productViewBody.querySelector(".modal-add-to-bag-btn").addEventListener("click", () => {
        const activeSizeBtn = productViewBody.querySelector(".size-btn.active");
        const selectedSize = activeSizeBtn ? activeSizeBtn.getAttribute("data-size") : "M";
        addToCart(product, selectedSize);
    });
}

// --- Toast notification ---
function showToast(message, iconName = "fa-info-circle") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast glass-card";
    toast.innerHTML = \`
        <i class="fa-solid \${iconName}"></i>
        <span>\${message}</span>
    \`;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast-fade-out");
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, 3500);
}
`;

// 4. Assemble the Liquid Section Code
const liquidSectionCode = `{% comment %}
  GLAZE Storefront Section (Liquid Glass = visual design theme)
  Install: Copy this entire file and paste it into a new file sections/glaze-storefront.liquid in your Shopify Theme.
{% endcomment %}

{{ 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' | stylesheet_tag }}

<style>
  ${styleCSS}
</style>

<div class="glaze-theme-wrapper" id="shopify-section-{{ section.id }}">
  {% if section.settings.collection != blank %}
    {% assign collection = collections[section.settings.collection] %}
  {% elsif collections['glaze-runway'] != blank %}
    {% assign collection = collections['glaze-runway'] %}
  {% else %}
    {% assign collection = collections.all %}
  {% endif %}

  {% if collection.products.size == 0 %}
    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; padding: 20px; text-align: center; margin: 40px auto; max-width: 800px; border-radius: 12px; font-family: sans-serif; backdrop-filter: blur(10px); z-index: 9999; position: relative;">
      <h3 style="margin-top: 0; color: #fca5a5; font-size: 1.1rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i> No Products Found in Collection</h3>
      <p style="font-size: 0.9rem; line-height: 1.5; margin: 10px 0;">
        The theme is trying to load products from the collection handle: <strong>"{{ collection.handle }}"</strong>, but it contains 0 items.
      </p>
      <div style="display: inline-block; text-align: left; font-size: 0.85rem; margin-top: 5px; line-height: 1.6; color: #cbd5e1;">
        <strong>How to resolve:</strong>
        <ol style="margin: 5px 0 0 20px; padding: 0;">
          <li>Make sure you have imported [shopify_import.csv](file:///d:/windowsssss/dropship/shopify_import.csv) in Shopify Admin.</li>
          <li>Ensure the imported products are set to <strong>Active</strong>.</li>
          <li>Ensure they are published to the <strong>Online Store</strong> sales channel (check "Manage Sales Channels" under product settings).</li>
        </ol>
      </div>
    </div>
  {% endif %}
  ${bodyContent}
</div>

<script>
  ${shopifyJS}
</script>

{% schema %}
{
  "name": "GLAZE Storefront Grid",
  "settings": [
    {
      "type": "collection",
      "id": "collection",
      "label": "Collection to Render",
      "info": "Choose the collection containing your apparel items."
    }
  ],
  "presets": [
    {
      "name": "GLAZE Storefront Grid",
      "category": "Custom Sections"
    }
  ]
}
{% endschema %}
`;

writeFileSync('./temp-shopify-theme/sections/glaze-storefront.liquid', liquidSectionCode, 'utf-8');
writeFileSync('./sections/glaze-storefront.liquid', liquidSectionCode, 'utf-8');

// Write theme.liquid boilerplate
const themeLiquid = `<!DOCTYPE html>
<html class="no-js" lang="{{ request.locale.iso_code }}">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-MD8DQMFD');</script>
    <!-- End Google Tag Manager -->
    <meta name="theme-color" content="">
    <link rel="canonical" href="{{ canonical_url }}">
    <title>{{ page_title }}</title>
    {% if page_description %}
      <meta name="description" content="{{ page_description | escape }}">
    {% endif %}
    <!-- Tracking Pixel -->
    <script>
      window.AYSzvothEK = window.AYSzvothEK || {
        q: [],
        track: function() { (this.q = this.q || []).push(['track', arguments]); },
        trackConversion: function() { (this.q = this.q || []).push(['trackConversion', arguments]); }
      };
    </script>
    <script src="https://s1.rbrun.com/e.min.js?source=cmrmwf37f000ydtnraghdreol" async></script>
    {{ content_for_header }}
  </head>
  <body style="margin: 0; padding: 0; background: #0a0b0e;">
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MD8DQMFD"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    {{ content_for_layout }}
  </body>
</html>`;
writeFileSync('./temp-shopify-theme/layout/theme.liquid', themeLiquid, 'utf-8');

// Write index.liquid
writeFileSync('./temp-shopify-theme/templates/index.liquid', "{% section 'glaze-storefront' %}", 'utf-8');

// Compile product.liquid standalone product template!
let productLiquid = readFileSync('src/product_template.liquid', 'utf-8');
productLiquid = productLiquid.replace('${styleCSS}', styleCSS);
writeFileSync('./temp-shopify-theme/templates/product.liquid', productLiquid, 'utf-8');
writeFileSync('./templates/product.liquid', productLiquid, 'utf-8');

// Write settings_schema.json
const schema = [
  {
    "name": "Theme information",
    "theme_name": "GLAZE Liquid Glass theme",
    "theme_author": "Antigravity AI",
    "theme_version": "1.0.0"
  }
];
writeFileSync('./temp-shopify-theme/config/settings_schema.json', JSON.stringify(schema, null, 2), 'utf-8');

// Write settings_data.json
const settingsData = {
  "current": {
    "sections": {
      "glaze-storefront": {
        "type": "glaze-storefront",
        "settings": {}
      }
    },
    "content_for_layout": [
      "glaze-storefront"
    ]
  }
};
writeFileSync('./temp-shopify-theme/config/settings_data.json', JSON.stringify(settingsData, null, 2), 'utf-8');

console.log(`\n==================================================`);
console.log(`SUCCESS: Compiled complete Shopify Theme scaffolding`);
console.log(`Location: ./temp-shopify-theme/`);
console.log(`==================================================\n`);

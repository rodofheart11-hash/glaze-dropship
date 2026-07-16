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
let PRODUCTS = [
  {% for product in collection.products %}
  {
    id: "{{ product.id }}",
    name: "{{ product.title | escape }}",
    category: "{{ product.type | handleize }}",
    categoryLabel: "{{ product.type | escape }}",
    price: {{ product.price | divided_by: 100.0 }},
    rating: 4.8,
    reviewsCount: 124,
    image: "{% if product.featured_image %}{{ product.featured_image | image_url: width: 800 }}{% else %}https://files.catbox.moe/hgn95m.jpg{% endif %}",
    tag: "{% if product.available %}Bestseller{% else %}Sold Out{% endif %}",
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

// Post-process PRODUCTS to extract specs from description HTML and clean up description text
PRODUCTS.forEach(product => {
  if (product.description.includes('Specifications')) {
    try {
      const txt = document.createElement("textarea");
      txt.innerHTML = product.description;
      const rawHtml = txt.value;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');
      
      const liElements = doc.querySelectorAll('li');
      liElements.forEach(li => {
        const strong = li.querySelector('strong');
        if (strong) {
          const key = strong.textContent.replace(':', '').trim();
          const value = li.textContent.replace(strong.textContent, '').trim();
          product.specs[key] = value;
        }
      });
      
      const pElements = doc.querySelectorAll('p');
      if (pElements.length > 0) {
        product.description = Array.from(pElements).map(p => p.outerHTML).join('');
      } else {
        const parts = rawHtml.split(/<h[23]>/i);
        product.description = parts[0].trim();
      }
    } catch (e) {
      console.error("Failed to parse product specifications:", e);
    }
  }
});

// Fallback to static catalog if Shopify returns 0 products (collection not configured yet)
if (PRODUCTS.length === 0) {
  PRODUCTS = [
    {
      id: "B0FT4QF9D5",
      name: "GLAZE Flow Midi Sundress",
      category: "dresses",
      categoryLabel: "Dresses",
      price: 32.99,
      rating: 4.5,
      reviewsCount: 2393,
      image: "https://files.catbox.moe/rabxm9.jpg",
      tag: "Best Seller",
      description: "A lightweight, flowy midi sundress cut for warm-weather days and vacations. Soft, breathable fabric with a relaxed drape and handy side pockets.",
      specs: {
        material: "Rayon / spandex blend",
        fit: "Relaxed A-line midi length",
        features: "Two side pockets, elastic comfort waist",
        care: "Machine wash cold, hang dry"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0CSDK2C3P",
      name: "GLAZE UV-Shield Long Sleeve Sun Shirt",
      category: "activewear",
      categoryLabel: "Activewear",
      price: 27.99,
      rating: 4.6,
      reviewsCount: 3506,
      image: "https://files.catbox.moe/17e114.jpg",
      tag: "Sun Protection",
      description: "A lightweight, quick-drying long sleeve shirt with UPF 50+ rated sun protection. Made for hiking, workouts and long days outdoors, with a breathable feel that helps keep you cool.",
      specs: {
        material: "Polyester / spandex blend",
        protection: "UPF 50+ rated fabric (manufacturer tested)",
        performance: "Moisture-wicking, quick-drying",
        fit: "Lightweight, breathable long sleeve"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0BV241H3F",
      name: "GLAZE Summer Linen-Blend Button-Down",
      category: "activewear",
      categoryLabel: "Shirts",
      price: 34.99,
      rating: 4.4,
      reviewsCount: 14800,
      image: "https://files.catbox.moe/h64bqu.jpg",
      tag: "Summer Classic",
      description: "A relaxed short-sleeve button-down in a breathable linen-cotton blend. A lightweight staple for the beach, summer events and everyday warm-weather wear.",
      specs: {
        material: "Linen / cotton blend",
        fit: "Relaxed casual fit",
        features: "Button-down front, short sleeve",
        care: "Machine wash cold, iron low if needed"
      },
      sizes: ["M", "L", "XL", "XXL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B09P3RHNSY",
      name: "GLAZE Aero Men's Running Shorts",
      category: "activewear",
      categoryLabel: "Activewear",
      price: 26.99,
      rating: 4.5,
      reviewsCount: 19928,
      image: "https://files.catbox.moe/oms6xl.jpg",
      tag: "Top Rated",
      description: "Lightweight athletic shorts built for running, gym and court sports. Quick-drying fabric with three zippered pockets to keep your phone and keys secure while you move.",
      specs: {
        material: "Polyester / spandex blend",
        pockets: "Three zippered pockets",
        performance: "Quick-drying, lightweight",
        fit: "Athletic fit with mesh liner"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B09MKNL9M3",
      name: "GLAZE Aero Women's Athletic Shorts",
      category: "activewear",
      categoryLabel: "Activewear",
      price: 24.99,
      rating: 4.5,
      reviewsCount: 12857,
      image: "https://files.catbox.moe/r4s2lf.jpg",
      tag: "Best Seller",
      description: "High-waisted running shorts with a secure pocket, made for gym workouts and everyday active wear. Stretchy, comfortable fabric with a flattering high-rise waistband.",
      specs: {
        material: "Polyester / spandex blend",
        waist: "High-waisted elastic waistband",
        pockets: "Side pocket",
        fit: "Sporty running short"
      },
      sizes: ["XS", "S", "M", "L"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0CKZ4ZWYG",
      name: "GLAZE Everyday High-Waisted Leggings",
      category: "activewear",
      categoryLabel: "Activewear",
      price: 15.99,
      rating: 4.6,
      reviewsCount: 12949,
      image: "https://files.catbox.moe/rrpwrx.jpg",
      tag: "Great Value",
      description: "Buttery-soft high-waisted leggings with side pockets. A stretchy, comfortable everyday layer for yoga, workouts and lounging.",
      specs: {
        material: "Polyester / spandex blend",
        waist: "High-waisted",
        features: "Side pockets, 4-way stretch",
        fit: "Full length, buttery-soft feel"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0FP5BYXVR",
      name: "GLAZE Palazzo Wide-Leg Pants",
      category: "activewear",
      categoryLabel: "Pants",
      price: 32.99,
      rating: 4.5,
      reviewsCount: 2745,
      image: "https://files.catbox.moe/ivmew0.jpg",
      tag: "Summer Favorite",
      description: "Flowy wide-leg palazzo pants with a drawstring elastic waist and pockets. Lightweight and breezy for summer, the beach and vacation.",
      specs: {
        material: "Rayon blend",
        fit: "Wide-leg palazzo cut",
        waist: "Drawstring elastic waist",
        features: "Side pockets"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0FTSVKP9B",
      name: "GLAZE Ribbed Knit Tank Top",
      category: "activewear",
      categoryLabel: "Tops",
      price: 14.99,
      rating: 4.6,
      reviewsCount: 2032,
      image: "https://files.catbox.moe/u8xrnb.jpg",
      tag: "Summer Basic",
      description: "A slim-fitting V-neck ribbed knit tank top. A soft, stretchy basic that layers easily and works for everyday summer wear.",
      specs: {
        material: "Ribbed cotton blend",
        neckline: "V-neck",
        fit: "Slim, fitted sleeveless",
        care: "Machine wash cold"
      },
      sizes: ["XS", "S", "M", "L"],
      variantsMap: { "M": "1" }
    }
  ];
}

let cart = [];
let activeCategory = "all";
let activeModalProduct = null;

// --- DOM Elements ---
const productGrid = document.getElementById("product-grid");
const filterTabs = document.querySelectorAll(".filter-tab");
const cartBtn = document.getElementById("cart-btn");
const cartBadge = document.querySelector(".cart-badge");
const cartDrawerOverlay = document.getElementById("cart-drawer-overlay");
const closeCartBtn = document.getElementById("close-cart-btn");
const cartItemsContainer = document.getElementById("cart-items-container");
const cartSubtotalVal = document.getElementById("cart-subtotal-value");
const checkoutBtn = document.getElementById("checkout-btn");
const productModal = document.getElementById("product-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const modalProductDetails = document.getElementById("modal-product-details");
const checkoutSuccessModal = document.getElementById("checkout-success-modal");
const successCloseBtn = document.getElementById("success-close-btn");
const orderRefCode = document.getElementById("order-ref-code");
const toastContainer = document.getElementById("toast-container");
const newsletterForm = document.getElementById("newsletter-form");

// --- Initialization ---
function initGlaze() {
    renderProducts();
    setupEventListeners();
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

    // Category Filtering
    filterTabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            filterTabs.forEach(t => t.classList.remove("active"));
            e.target.classList.add("active");
            activeCategory = e.target.getAttribute("data-category");
            renderProducts();
            if (window.AYSzvothEK) {
                window.AYSzvothEK.track('collection_viewed', { category: activeCategory });
            }
            if (window.Shopify && window.Shopify.analytics) {
                window.Shopify.analytics.publish('custom_collection_viewed', { category: activeCategory });
            }
        });
    });

    // Cart Drawer Toggle
    cartBtn.addEventListener("click", () => {
        cartDrawerOverlay.classList.add("active");
        if (window.AYSzvothEK) {
            window.AYSzvothEK.track('cart_viewed');
        }
        if (window.Shopify && window.Shopify.analytics) {
            window.Shopify.analytics.publish('custom_cart_viewed', {});
        }
    });

    closeCartBtn.addEventListener("click", () => {
        cartDrawerOverlay.classList.remove("active");
    });

    cartDrawerOverlay.addEventListener("click", (e) => {
        if (e.target === cartDrawerOverlay) {
            cartDrawerOverlay.classList.remove("active");
        }
    });

    // Modal Close
    closeModalBtn.addEventListener("click", () => {
        productModal.classList.remove("active");
    });

    productModal.addEventListener("click", (e) => {
        if (e.target === productModal) {
            productModal.classList.remove("active");
        }
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

// --- Render Product Grid ---
function renderProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = "";

    const filtered = activeCategory === "all" 
        ? PRODUCTS 
        : PRODUCTS.filter(p => p.category === activeCategory);

    if (filtered.length === 0) {
        productGrid.innerHTML = \`<div class="empty-message">No items found in this category.</div>\`;
        return;
    }

    filtered.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.setAttribute("data-id", product.id);

        card.innerHTML = \`
            <div class="product-img-wrapper">
                <div class="glass-reflection-shine"></div>
                <img src="\${product.image}" alt="\${product.name}" class="product-img" loading="lazy">
                <div class="product-badge">\${product.tag}</div>
            </div>
            <div class="product-info">
                <div class="product-meta">
                    <span class="product-category">\${product.categoryLabel}</span>
                    <div class="product-rating">
                        <span class="stars-inline">\${renderStars(product.rating)}</span>
                        <span class="rating-count">\${product.rating} (\${Number(product.reviewsCount).toLocaleString()})</span>
                    </div>
                </div>
                <h3 class="product-name">\${product.name}</h3>
                <div class="product-price-row">
                    <span class="product-price">\$\${product.price.toFixed(2)}</span>
                    <button class="btn-add-cart" title="Add to Bag">
                        <i class="fa-solid fa-bag-shopping"></i>
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

        // Bind open details modal on card click
        card.addEventListener("click", () => {
            openProductModal(product);
        });

        productGrid.appendChild(card);
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
        cartDrawerOverlay.classList.add("active");
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
                <i class="fa-solid fa-wind"></i>
                <p>Your bag is empty.</p>
                <button class="btn btn-secondary close-cart-btn-action" style="font-size:0.85rem; padding:10px 20px;">Browse Collection</button>
            </div>
        \`;

        const browseBtn = cartItemsContainer.querySelector(".close-cart-btn-action");
        if (browseBtn) {
            browseBtn.addEventListener("click", () => {
                cartDrawerOverlay.classList.remove("active");
            });
        }

        cartBadge.classList.remove("active");
        cartBadge.innerText = "0";
        cartSubtotalVal.innerText = "$0.00";
        checkoutBtn.disabled = true;
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
    cartBadge.innerText = itemCount;
    cartBadge.classList.add("active");
    cartSubtotalVal.innerText = \`\$\${totalPrice.toFixed(2)}\`;
    checkoutBtn.disabled = false;
}

// --- Product Detail Modal ---
function openProductModal(product) {
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

    modalProductDetails.innerHTML = \`
        <div class="modal-img-wrapper glass-card">
            <div class="glass-reflection-shine"></div>
            <img src="\${product.image}" alt="\${product.name}" class="modal-product-img">
        </div>
        <div class="modal-details">
            <span class="modal-category">\${product.categoryLabel}</span>
            <h2 class="modal-product-name">\${product.name}</h2>
            <div class="modal-rating-row">
                <div class="stars">\${renderStars(product.rating)}</div>
                <span class="reviews-count">\${product.rating} · \${Number(product.reviewsCount).toLocaleString()} reviews</span>
            </div>
            <span class="modal-product-price">\$\${product.price.toFixed(2)}</span>
            <p class="modal-product-desc">\${product.description}</p>
            
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

            \${specsHTML}

            <button class="btn btn-primary modal-add-to-bag-btn">
                <i class="fa-solid fa-bag-shopping"></i> Add To Bag
            </button>

            <div class="trust-badges">
                <div class="trust-badge"><i class="fa-solid fa-truck-fast"></i><span>Free worldwide shipping</span></div>
                <div class="trust-badge"><i class="fa-solid fa-rotate-left"></i><span>30-day easy returns</span></div>
                <div class="trust-badge"><i class="fa-solid fa-lock"></i><span>Secure checkout</span></div>
            </div>
        </div>
    \`;

    // Size Guide Toggle
    const sizeGuideToggle = modalProductDetails.querySelector(".size-guide-toggle");
    const sizeGuidePanel = modalProductDetails.querySelector(".size-guide-panel");
    if (sizeGuideToggle && sizeGuidePanel) {
        sizeGuideToggle.addEventListener("click", () => {
            sizeGuidePanel.hidden = !sizeGuidePanel.hidden;
        });
    }

    // Size Selection Handlers
    const sizeBtns = modalProductDetails.querySelectorAll(".size-btn");
    sizeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            sizeBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
        });
    });

    // Add To Bag in Modal Handler
    modalProductDetails.querySelector(".modal-add-to-bag-btn").addEventListener("click", () => {
        const activeSizeBtn = modalProductDetails.querySelector(".size-btn.active");
        const selectedSize = activeSizeBtn ? activeSizeBtn.getAttribute("data-size") : "M";
        addToCart(product, selectedSize);
        productModal.classList.remove("active");
    });

    productModal.classList.add("active");
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

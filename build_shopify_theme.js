/**
 * GLAZE® Shopify Section Compiler
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
   GLAZE® Liquid Glass Clothing - Shopify AJAX Cart Integration
   ========================================================================== */

// --- Shopify Dynamic Products Config ---
// This extracts the active collection products mapped directly in Liquid!
const PRODUCTS = [
  {% for product in collection.products %}
  {
    id: "{{ product.id }}",
    name: "{{ product.title | escape }}",
    category: "{{ product.type | handleize }}",
    categoryLabel: "{{ product.type | escape }}",
    price: {{ product.price | money_without_currency | replace: ',', '' }},
    rating: 4.8,
    reviewsCount: 124,
    image: "{{ product.featured_image | image_url: width: 800 }}",
    tag: "{% if product.available %}Bestseller{% else %}Sold Out{% endif %}",
    description: "{{ product.description | strip_html | escape | strip_newlines }}",
    specs: {
      material: "Shopify Managed Fabric",
      care: "Standard Care instructions",
      fit: "Tailored fit"
    },
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
document.addEventListener("DOMContentLoaded", () => {
    renderProducts();
    setupEventListeners();
    syncShopifyCart();
});

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Category Filtering
    filterTabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            filterTabs.forEach(t => t.classList.remove("active"));
            e.target.classList.add("active");
            activeCategory = e.target.getAttribute("data-category");
            renderProducts();
        });
    });

    // Cart Drawer Toggle
    cartBtn.addEventListener("click", () => {
        cartDrawerOverlay.classList.add("active");
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

    // Checkout Action -> Redirect directly to Shopify Checkout!
    checkoutBtn.addEventListener("click", () => {
        window.location.href = '/checkout';
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

// --- Render Product Grid ---
function renderProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = "";

    const filtered = activeCategory === "all" 
        ? PRODUCTS 
        : PRODUCTS.filter(p => p.category === activeCategory);

    if (filtered.length === 0) {
        productGrid.innerHTML = \`<div class="empty-message">No designs found in this matrix segment.</div>\`;
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
                <button class="quick-add-btn" title="Quick Add">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
            <div class="product-info">
                <div class="product-meta">
                    <span class="product-category">\${product.categoryLabel}</span>
                    <div class="product-rating">
                        <i class="fa-solid fa-star"></i>
                        <span>\${product.rating}</span>
                    </div>
                </div>
                <h3 class="product-name">\${product.name}</h3>
                <div class="product-footer">
                    <span class="product-price">\$\${product.price.toFixed(2)}</span>
                    <button class="view-details-btn">View Details</button>
                </div>
            </div>
        \`;

        // Bind quick add
        card.querySelector(".quick-add-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            const defaultSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : "M";
            addToCart(product, defaultSize);
        });

        // Bind open details modal
        card.querySelector(".view-details-btn").addEventListener("click", () => {
            openProductModal(product);
        });
        card.addEventListener("click", () => {
            openProductModal(product);
        });

        productGrid.appendChild(card);
    });
}

// --- Add Item to Shopify Cart (AJAX) ---
function addToCart(product, size) {
    const variantId = product.variantsMap ? product.variantsMap[size] : null;
    if (!variantId) {
        showToast("Error: Size variant not found.", "fa-circle-xmark");
        return;
    }

    showToast(\`Adding \${product.name} (\${size}) to bag...\`, "fa-spinner");

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
        showToast(\`Added \${product.name} to bag!\`, "fa-bag-shopping");
        syncShopifyCart();
        cartDrawerOverlay.classList.add("active");
    })
    .catch(err => {
        console.error("Cart add error: ", err);
        showToast("Failed to add. Make sure variant is in stock.", "fa-circle-exclamation");
    });
}

// --- Modify Variant Quantity in Shopify Cart (AJAX) ---
function changeQuantity(variantId, newQty) {
    fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: String(variantId),
            quantity: newQty
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

        // Handle quantity decrement
        cartItemEl.querySelector(".dec-qty-btn").addEventListener("click", () => {
            changeQuantity(item.variantId, item.quantity - 1);
        });

        // Handle quantity increment
        cartItemEl.querySelector(".inc-qty-btn").addEventListener("click", () => {
            changeQuantity(item.variantId, item.quantity + 1);
        });

        // Handle deletion
        cartItemEl.querySelector(".btn-remove-item").addEventListener("click", () => {
            changeQuantity(item.variantId, 0);
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
    activeModalProduct = product;
    
    // Format specifications
    let specsHTML = "";
    if (product.specs) {
        specsHTML = \`<div class="modal-specs-grid">\`;
        for (const [key, value] of Object.entries(product.specs)) {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            specsHTML += \`
                <div class="spec-item">
                    <span class="spec-lbl">\${label}</span>
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
                <button class="size-select-btn \${idx === 0 ? 'active' : ''}" data-size="\${size}">\${size}</button>
            \`;
        });
    }

    modalProductDetails.innerHTML = \`
        <div class="modal-body-grid">
            <div class="modal-img-wrapper glass-card">
                <div class="glass-reflection-shine"></div>
                <img src="\${product.image}" alt="\${product.name}" class="modal-product-img">
            </div>
            <div class="modal-details">
                <span class="modal-category">\${product.categoryLabel}</span>
                <h2 class="modal-product-name">\${product.name}</h2>
                <div class="modal-rating-row">
                    <div class="stars">
                        <i class="fa-solid fa-star"></i>
                        <i class="fa-solid fa-star"></i>
                        <i class="fa-solid fa-star"></i>
                        <i class="fa-solid fa-star"></i>
                        <i class="fa-solid fa-star"></i>
                    </div>
                    <span class="reviews-count">(\${product.reviewsCount} reviews)</span>
                </div>
                <span class="modal-product-price">\$\${product.price.toFixed(2)}</span>
                <p class="modal-product-desc">\${product.description}</p>
                
                <div class="size-selector-wrapper">
                    <span class="size-selector-label">Select Size</span>
                    <div class="size-buttons-row">
                        \${sizesHTML}
                    </div>
                </div>

                \${specsHTML}

                <button class="btn btn-primary modal-add-to-bag-btn">
                    <i class="fa-solid fa-bag-shopping"></i> Add To Bag
                </button>
            </div>
        </div>
    \`;

    // Size Selection Handlers
    const sizeBtns = modalProductDetails.querySelectorAll(".size-select-btn");
    sizeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            sizeBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
        });
    });

    // Add To Bag in Modal Handler
    modalProductDetails.querySelector(".modal-add-to-bag-btn").addEventListener("click", () => {
        const activeSizeBtn = modalProductDetails.querySelector(".size-select-btn.active");
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
  GLAZE® Liquid Glass Clothing Storefront Section
  Install: Copy this entire file and paste it into a new file sections/glaze-storefront.liquid in your Shopify Theme.
{% endcomment %}

{{ 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' | stylesheet_tag }}

<style>
  ${styleCSS}
</style>

<div class="glaze-theme-wrapper" id="shopify-section-{{ section.id }}">
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
      "info": "Choose the collection containing your liquid glass clothing items."
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

// Write theme.liquid boilerplate
const themeLiquid = `<!DOCTYPE html>
<html class="no-js" lang="{{ request.locale.iso_code }}">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="">
    <link rel="canonical" href="{{ canonical_url }}">
    <title>{{ page_title }}</title>
    {% if page_description %}
      <meta name="description" content="{{ page_description | escape }}">
    {% endif %}
    {{ content_for_header }}
  </head>
  <body style="margin: 0; padding: 0; background: #0a0b0e;">
    {{ content_for_layout }}
  </body>
</html>`;
writeFileSync('./temp-shopify-theme/layout/theme.liquid', themeLiquid, 'utf-8');

// Write index.liquid
writeFileSync('./temp-shopify-theme/templates/index.liquid', "{% section 'glaze-storefront' %}", 'utf-8');

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

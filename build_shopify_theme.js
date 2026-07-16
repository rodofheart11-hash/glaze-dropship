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
      id: "hydro-jacket",
      name: "GLAZE Hydro-Weave™ Coat",
      category: "outerwear",
      categoryLabel: "Outerwear",
      price: 778.00,
      rating: 4.9,
      reviewsCount: 142,
      image: "https://files.catbox.moe/hgn95m.jpg",
      tag: "Bestseller",
      description: "An ultra-futuristic coat woven from translucent hydrophobic liquid-glass polymer fibers. Water, oils, and mud slide right off without leaving a trace.",
      specs: {
        material: "92% Glass Polymer, 8% Elastane",
        treatment: "Fused Silica Oleophobic Matrix",
        weight: "220g / Ultra-Lightweight",
        transparency: "92% Light Transmittance"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "neo-dress",
      name: "NEO Bloom™ Iridescent Dress",
      category: "dresses",
      categoryLabel: "Dresses",
      price: 1040.00,
      rating: 5.0,
      reviewsCount: 88,
      image: "https://files.catbox.moe/8qlm4b.jpg",
      tag: "Limited Drop",
      description: "An elegant, structural cocktail dress that shifts color from glowing violet to vibrant magenta depending on ambient light angles and body temperature.",
      specs: {
        material: "100% Crystalline Silica-Silk Blend",
        treatment: "Thermochromic Iridescent Glaze",
        stretch: "Low-Stretch Tailored Silhouette",
        care: "Specialized Ultrasonic Clean Only"
      },
      sizes: ["XS", "S", "M", "L"],
      variantsMap: { "M": "1" }
    },
    {
      id: "chroma-hoodie",
      name: "CHROMA Prism™ Tech Hoodie",
      category: "outerwear",
      categoryLabel: "Outerwear / Techwear",
      price: 590.00,
      rating: 4.8,
      reviewsCount: 204,
      image: "https://files.catbox.moe/0u8gzf.jpg",
      tag: "New Arrival",
      description: "Futuristic street fashion combined with modular technology. Features frosted glassmorphic shoulder armor plates and color-shifting geometric safety piping.",
      specs: {
        material: "80% Organic Cotton, 20% Tech Glass-Weave",
        features: "Reinforced Frosted Panels, Dual-Zip",
        fit: "Relaxed Boxy Streetwear Fit",
        insulation: "Thermal Micro-Grid Interior"
      },
      sizes: ["S", "M", "L", "XL", "XXL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0FT4QF9D5",
      name: "GLAZE Flow-Midi™ Sundress",
      category: "dresses",
      categoryLabel: "Dresses / Imported",
      price: 35.98,
      rating: 4.5,
      reviewsCount: 2393,
      image: "https://files.catbox.moe/rabxm9.jpg",
      tag: "Imported Best Seller",
      description: "A flowy liquid-glass draped sundress. Weaves light-transmitting silica micro-threads with soft rayon to create a dress that falls and behaves like fluid crystal.",
      specs: {
        material: "90% Breathable Rayon, 10% Micro-Silica Glass Fiber",
        features: "Self-Draping, Dual Pockets, Hydrophobic Shield",
        origin: "Scraped and Imported from Amazon US",
        comfort: "Ultra-Flow Elastic Comfort Waist"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0CSDK2C3P",
      name: "GLAZE UV-Shield™ Longsleeve",
      category: "activewear",
      categoryLabel: "Activewear / Imported",
      price: 39.98,
      rating: 4.6,
      reviewsCount: 3506,
      image: "https://files.catbox.moe/17e114.jpg",
      tag: "Amazon Import",
      description: "High-performance UV-deflecting long sleeve shirt. Woven with reflective glass threads that block UPF 50+ solar radiation while allowing maximum cooling.",
      specs: {
        material: "88% Polyester, 12% Glass-Weave UPF Thread",
        protection: "UPF 50+ Crystalline Solar Shield",
        dryRate: "Nano-Pores for 3x Faster Drying",
        weight: "Super Lightweight Cooling Wear"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0BV241H3F",
      name: "GLAZE Prism-Linen™ Button-Down",
      category: "activewear",
      categoryLabel: "Activewear / Shirts",
      price: 59.98,
      rating: 4.4,
      reviewsCount: 14800,
      image: "https://files.catbox.moe/h64bqu.jpg",
      tag: "Imported Classic",
      description: "Classic short-sleeve button-down made from silica-enhanced linen fibers that refract ambient light, actively keeping you cool while repelling sweat and stains.",
      specs: {
        material: "70% Organic Linen, 30% Fused Silica Blend",
        structure: "Refractive Prism Weave",
        fit: "Relaxed Summer Beach Fit",
        features: "Fully Stain-Proof & Wrinkle-Resistant"
      },
      sizes: ["M", "L", "XL", "XXL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B09P3RHNSY",
      name: "GLAZE Aero-Active™ Shorts",
      category: "activewear",
      categoryLabel: "Activewear / Imported",
      price: 49.98,
      rating: 4.5,
      reviewsCount: 19928,
      image: "https://files.catbox.moe/oms6xl.jpg",
      tag: "Top Rated Import",
      description: "Lightweight active shorts with glassmorphic mesh side panels. Fuses moisture-wicking stretch fibers with a hydrophobic liquid-glass water guard.",
      specs: {
        material: "92% Nylon, 8% Spandex, Micro-Glass Mesh Panels",
        pockets: "Triple Glass-Secured Zippers",
        protection: "Durable Hydrophobic Water Guard",
        stretch: "4-Way Extreme Motion Stretch"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B09MKNL9M3",
      name: "GLAZE Aero-Sporty Shorts",
      category: "activewear",
      categoryLabel: "Activewear / Women's",
      price: 39.98,
      rating: 4.5,
      reviewsCount: 12857,
      image: "https://files.catbox.moe/r4s2lf.jpg",
      tag: "Active Bestseller",
      description: "High-waisted running shorts with integrated side pockets. Coated with a dirt-repelling silica treatment and woven with stretchable glass-core active fibers.",
      specs: {
        material: "88% Polyester, 12% Spandex, Silica Coat",
        pocket: "Dual Glass-Sewn Secure Side Pockets",
        waist: "Wide Elastic Tummy Control Band",
        aeration: "Side-Split Air Flow Paneling"
      },
      sizes: ["XS", "S", "M", "L"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0CKZ4ZWYG",
      name: "GLAZE Contour-Shield Leggings",
      category: "activewear",
      categoryLabel: "Activewear / Leggings",
      price: 12.78,
      rating: 4.6,
      reviewsCount: 12949,
      image: "https://files.catbox.moe/rrpwrx.jpg",
      tag: "Super Value",
      description: "Buttery-soft high-waisted compression leggings. Built from high-stretch fibers bonded with an ultra-thin moisture barrier that rejects sweat and water.",
      specs: {
        material: "90% Polyester, 10% Lycra, Micro-Silica Shield",
        compression: "High-Density Sculpting Knit",
        features: "Hidden Key Pocket, Zero Stain Grid",
        stretch: "4-Way Squat-Proof Stretch"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B01GH5GSLG",
      name: "GLAZE Tech-Performance Polo",
      category: "activewear",
      categoryLabel: "Activewear / Golf",
      price: 70.00,
      rating: 4.6,
      reviewsCount: 15531,
      image: "https://files.catbox.moe/hgo6lj.jpg",
      tag: "Performance Pro",
      description: "Classic collared golf polo with nanotech heat dispersal. Woven with smooth, friction-free micro-glass threads that draw body heat away.",
      specs: {
        material: "95% Polyester, 5% Glass-Infused Thread",
        cooling: "Endothermic Heat Release Grid",
        stretch: "4-Way Comfort Stretch Fit",
        uvRating: "UPF 50+ Solar Deflector"
      },
      sizes: ["S", "M", "L", "XL", "XXL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0018OKNWM",
      name: "GLAZE Deni-Matrix Jeans",
      category: "outerwear",
      categoryLabel: "Outerwear / Denim",
      price: 89.94,
      rating: 4.5,
      reviewsCount: 30385,
      image: "https://files.catbox.moe/1zmw8n.jpg",
      tag: "Denim Classic",
      description: "Regular fit denim jeans reinforced at the molecular level with a clear silica spray coating. Stain-proof, splash-resistant, and highly durable.",
      specs: {
        material: "99% Heavy Cotton Denim, 1% Poly-Silica Guard",
        fit: "Regular Straight-Leg Cut",
        stains: "Repels coffee, mud, and water splashes",
        care: "Standard machine wash, coating retains up to 100 washes"
      },
      sizes: ["28x30", "30x30", "32x30", "34x32", "36x32"],
      variantsMap: { "32x30": "1" }
    },
    {
      id: "B0FP5BYXVR",
      name: "GLAZE Palazzo-Flow™ Wide-Leg Pants",
      category: "activewear",
      categoryLabel: "Activewear / Imported",
      price: 35.98,
      rating: 4.5,
      reviewsCount: 2745,
      image: "https://files.catbox.moe/ivmew0.jpg",
      tag: "Imported Palazzo",
      description: "Flowy palazzo drawstring pants woven with light-transmitting silica micro-threads. Behaves like fluid crystal while keeping you completely cool.",
      specs: {
        material: "90% Rayon, 10% Micro-Silica Glass Fiber",
        fit: "Wide Leg Palazzo Cut",
        comfort: "Drawstring Elastic Waist"
      },
      sizes: ["S", "M", "L", "XL"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0FTSVKP9B",
      name: "GLAZE Ribbed-Knit™ Tank Top",
      category: "activewear",
      categoryLabel: "Activewear / Tops",
      price: 16.20,
      rating: 4.6,
      reviewsCount: 2032,
      image: "https://files.catbox.moe/u8xrnb.jpg",
      tag: "Summer Ribbed",
      description: "Sleek tank top woven with glowing liquid-glass optical micro-threads. Fits like a second skin with stretch-comfort cooling fiber matrix.",
      specs: {
        material: "95% Ribbed Cotton, 5% Nano-Silica Fiber",
        weave: "Friction-Free Micro-Glass Knit",
        cooling: "Advanced Heat Release Channels"
      },
      sizes: ["XS", "S", "M", "L"],
      variantsMap: { "M": "1" }
    },
    {
      id: "B0785VXRX2",
      name: "GLAZE Tech-Comfort™ Active Tee",
      category: "activewear",
      categoryLabel: "Activewear / Performance",
      price: 50.00,
      rating: 4.6,
      reviewsCount: 25950,
      image: "https://files.catbox.moe/5whik4.jpg",
      tag: "Performance Tech",
      description: "Futuristic short-sleeve athletic active tee. Woven with translucent, quick-drying silica threads that reflect heat away.",
      specs: {
        material: "92% Recycled Polyester, 8% Spandex, Nano-Silica Guard",
        protection: "UPF 50+ Solar Deflector",
        weave: "Refractive Diamond Tech Weave"
      },
      sizes: ["S", "M", "L", "XL", "XXL"],
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

    // Checkout Action -> Redirect directly to Shopify Checkout!
    checkoutBtn.addEventListener("click", () => {
        if (window.AYSzvothEK) {
            window.AYSzvothEK.track('checkout_started');
        }
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
    
    // Detect if this is a mock product (non-Shopify numerical ID)
    const isMock = !variantId || String(variantId).length < 8 || String(variantId) === "1";
    
    if (isMock) {
        const existing = cart.find(item => item.product.id === product.id && item.size === size);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({
                product: product,
                size: size,
                quantity: 1,
                variantId: variantId || 'mock-' + Math.random().toString(36).substr(2, 9)
            });
        }
        showToast("Added " + product.name + " to bag!", "fa-bag-shopping");
        updateCartUI(
            cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
            cart.reduce((sum, item) => sum + item.quantity, 0)
        );
        cartDrawerOverlay.classList.add("active");
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
        showToast("Failed to add. Make sure variant is in stock.", "fa-circle-exclamation");
    });
}

// --- Modify Variant Quantity in Shopify Cart (AJAX) ---
function changeQuantity(variantId, newQty) {
    const isMock = !variantId || String(variantId).length < 8 || String(variantId).includes('mock') || String(variantId) === "1";
    if (isMock) {
        const idx = cart.findIndex(item => item.variantId === variantId);
        if (idx !== -1) {
            if (newQty <= 0) {
                cart.splice(idx, 1);
            } else {
                cart[idx].quantity = newQty;
            }
            updateCartUI(
                cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
                cart.reduce((sum, item) => sum + item.quantity, 0)
            );
        }
        return;
    }

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
                <button class="size-btn \${idx === 0 ? 'active' : ''}" data-size="\${size}">\${size}</button>
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
                
                <div style="margin: 20px 0;">
                    <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">Select Size</h4>
                    <div class="size-selector">
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
  GLAZE® Liquid Glass Clothing Storefront Section
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

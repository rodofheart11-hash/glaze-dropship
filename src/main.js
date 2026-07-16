/* ==========================================================================
   GLAZE Clothing - Core Application State Engine
   ========================================================================== */

// Import styling system and product list module
import './style.css';
import { PRODUCTS } from './products.js';

// --- App State ---
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
function init() {
    if (window.glazeInitialized) return;
    window.glazeInitialized = true;
    renderProducts();
    setupEventListeners();
    syncShopifyCart();
    if (window.AYSzvothEK) {
        window.AYSzvothEK.track('page_viewed');
    }
}
document.addEventListener("DOMContentLoaded", init);
if (document.readyState === "interactive" || document.readyState === "complete") {
    init();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
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
    successCloseBtn.addEventListener("click", () => {
        checkoutSuccessModal.classList.remove("active");
    });

    // Newsletter Submission
    newsletterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const emailInput = newsletterForm.querySelector("input");
        showToast(`Successfully subscribed: ${emailInput.value}!`, "fa-circle-check");
        emailInput.value = "";
    });

    // Scroll Effects for floating navigation
    window.addEventListener("scroll", () => {
        const header = document.querySelector(".main-header");
        if (!header) return;
        if (window.scrollY > 50) {
            header.style.background = "rgba(7, 8, 13, 0.75)";
            header.style.top = "10px";
            header.style.height = "65px";
        } else {
            header.style.background = "rgba(10, 11, 18, 0.45)";
            header.style.top = "20px";
            header.style.height = "70px";
        }
    });
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
    
    const filteredProducts = activeCategory === "all" 
        ? PRODUCTS 
        : PRODUCTS.filter(p => p.category === activeCategory);

    if (filteredProducts.length === 0) {
        productGrid.innerHTML = `<p class="text-center w-100" style="grid-column: 1/-1; color: var(--text-muted);">No products found in this category.</p>`;
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card glass-card";
        card.setAttribute("data-id", product.id);

        card.innerHTML = `
            ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
            <div class="product-img-wrapper">
                <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
                <div class="product-actions-overlay">
                    <button class="action-btn view-details-btn" title="Quick View">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="action-btn direct-add-btn" title="Add to Bag">
                        <i class="fa-solid fa-bag-shopping"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <div class="product-meta">
                    <span class="product-category">${product.categoryLabel}</span>
                    <div class="product-rating">
                        <span class="stars-inline">${renderStars(product.rating)}</span>
                        <span class="rating-count">${product.rating} (${Number(product.reviewsCount).toLocaleString()})</span>
                    </div>
                </div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price-row">
                    <span class="product-price">$${product.price.toFixed(2)}</span>
                    <button class="btn-add-cart direct-add-btn" title="Add to Bag">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        `;

        // Card Event Listeners
        // 1. Mouse Move Reflection Effect
        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty("--mouse-x", `${x}px`);
            card.style.setProperty("--mouse-y", `${y}px`);
        });

        // 2. Open Modal via Click
        card.querySelector(".product-name").addEventListener("click", () => openModal(product));
        card.querySelector(".view-details-btn").addEventListener("click", () => openModal(product));

        // 3. Add to Cart with default size (M, or first available)
        card.querySelectorAll(".direct-add-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const defaultSize = product.sizes.includes("M") ? "M" : product.sizes[0];
                addToCart(product, defaultSize);
            });
        });

        productGrid.appendChild(card);
    });
}

// --- Open Product Detail Modal ---
function openModal(product) {
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
    
    // Generate Sizing Buttons HTML
    const defaultSize = product.sizes.includes("M") ? "M" : (product.sizes[1] || product.sizes[0]);
    let sizesHTML = "";
    product.sizes.forEach((size) => {
        sizesHTML += `
            <button class="size-btn ${size === defaultSize ? 'active' : ''}" data-size="${size}">
                ${size}
            </button>
        `;
    });

    // Generate Specs Table HTML
    let specsHTML = "";
    for (const [key, value] of Object.entries(product.specs)) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        specsHTML += `
            <div class="spec-item">
                <span class="spec-label">${formattedKey}</span>
                <span class="spec-val">${value}</span>
            </div>
        `;
    }

    modalProductDetails.innerHTML = `
        <div class="modal-img-wrapper">
            <img src="${product.image}" alt="${product.name}">
        </div>
        <div class="modal-details">
            <span class="product-category">${product.categoryLabel}</span>
            <h2 class="modal-product-name">${product.name}</h2>
            <div class="modal-rating-row">
                <div class="stars">${renderStars(product.rating)}</div>
                <span class="reviews-count">${product.rating} · ${Number(product.reviewsCount).toLocaleString()} reviews</span>
            </div>
            <div class="modal-product-price">$${product.price.toFixed(2)}</div>
            <p class="modal-product-desc">${product.description}</p>

            <div class="specs-grid">
                ${specsHTML}
            </div>

            <div class="size-head">
                <h4>Select Size</h4>
                <button type="button" class="size-guide-toggle"><i class="fa-solid fa-ruler"></i> Size guide</button>
            </div>
            <div class="size-selector" id="modal-size-selector">
                ${sizesHTML}
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

            <div class="modal-actions">
                <button class="btn btn-primary btn-add-modal glow-effect" id="modal-add-btn">
                    <span>Add to Shopping Bag</span>
                    <i class="fa-solid fa-bag-shopping"></i>
                </button>
            </div>

            <div class="trust-badges">
                <div class="trust-badge"><i class="fa-solid fa-truck-fast"></i><span>Free worldwide shipping</span></div>
                <div class="trust-badge"><i class="fa-solid fa-rotate-left"></i><span>30-day easy returns</span></div>
                <div class="trust-badge"><i class="fa-solid fa-lock"></i><span>Secure checkout</span></div>
            </div>
        </div>
    `;

    // Size Guide Toggle
    const sizeGuideToggle = modalProductDetails.querySelector(".size-guide-toggle");
    const sizeGuidePanel = modalProductDetails.querySelector(".size-guide-panel");
    if (sizeGuideToggle && sizeGuidePanel) {
        sizeGuideToggle.addEventListener("click", () => {
            sizeGuidePanel.hidden = !sizeGuidePanel.hidden;
        });
    }

    // Hook size button selections
    const sizeBtns = modalProductDetails.querySelectorAll(".size-btn");
    let selectedSize = product.sizes.includes("M") ? "M" : (product.sizes[1] || product.sizes[0]);

    sizeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            sizeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedSize = btn.getAttribute("data-size");
        });
    });

    // Hook modal add button
    modalProductDetails.querySelector("#modal-add-btn").addEventListener("click", () => {
        addToCart(product, selectedSize);
        productModal.classList.remove("active");
    });

    productModal.classList.add("active");
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
    const isValidVariant = variantId && /^\d{6,}$/.test(String(variantId));

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

function updateCartUI(totalPrice = 0, itemCount = 0) {
    if (!cartItemsContainer) return;
    
    // Clear items container
    cartItemsContainer.innerHTML = "";

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="cart-empty-message">
                <i class="fa-solid fa-wind"></i>
                <p>Your bag is empty.</p>
                <button class="btn btn-secondary close-cart-btn-action" style="font-size:0.85rem; padding:10px 20px;">Browse Collection</button>
            </div>
        `;

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
        cartItemEl.innerHTML = `
            <div class="cart-item-img-wrapper">
                <img src="${item.product.image}" alt="${item.product.name}">
            </div>
            <div class="cart-item-info">
                <h4 class="cart-item-name">${item.product.name}</h4>
                <span class="cart-item-size">Size: ${item.size}</span>
                <span class="cart-item-price">$${item.product.price.toFixed(2)}</span>
                <div class="cart-item-actions">
                    <div class="qty-controls">
                        <button class="qty-btn dec-qty-btn">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn inc-qty-btn">+</button>
                    </div>
                    <button class="btn-remove-item" title="Remove Item">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;

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

        // Handle item deletion
        cartItemEl.querySelector(".btn-remove-item").addEventListener("click", () => {
            changeQuantity(lineRef, 0);
        });

        cartItemsContainer.appendChild(cartItemEl);
    });

    // Update Badge & Totals
    cartBadge.innerText = itemCount;
    cartBadge.classList.add("active");
    cartSubtotalVal.innerText = `$${totalPrice.toFixed(2)}`;
    checkoutBtn.disabled = false;
}

// --- Checkout Handler ---
function handleCheckout() {
    const prefix = "GLZ";
    const num = Math.floor(100000 + Math.random() * 900000);
    orderRefCode.innerText = `#${prefix}-${num}`;

    cartDrawerOverlay.classList.remove("active");

    setTimeout(() => {
        checkoutSuccessModal.classList.add("active");
        cart = [];
        updateCartUI();
    }, 450);
}

// --- Floating Toast Utility ---
function showToast(message, iconName = "fa-info-circle") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast glass-card";
    toast.innerHTML = `
        <i class="fa-solid ${iconName}"></i>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toast-fade-out");
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, 3500);
}

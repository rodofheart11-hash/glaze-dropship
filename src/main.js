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
    if (window.glazeInitialized) return;
    window.glazeInitialized = true;
    // On (re-)init reset to Home root.
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
document.addEventListener("DOMContentLoaded", initGlaze);
if (document.readyState === "interactive" || document.readyState === "complete") {
    initGlaze();
}

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
            showToast(`Successfully subscribed: ${emailInput.value}!`, "fa-circle-check");
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
            appBarTitle.textContent = count > 0 ? `Shopping Bag (${count})` : "Shopping Bag";
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

// Rating label: include the review count only when we actually have reviews.
function ratingText(product) {
    const n = Number(product.reviewsCount) || 0;
    if (n > 0) return `<strong>${product.rating}</strong> · ${n.toLocaleString()} reviews`;
    return `<strong>${product.rating}</strong>`;
}

// --- Render Product Grid (into a target grid; optional pre-filtered list) ---
function renderProducts(gridEl, list) {
    gridEl = gridEl || productGrid;
    if (!gridEl) return;
    gridEl.innerHTML = "";

    const filteredProducts = list || (activeCategory === "all"
        ? PRODUCTS
        : PRODUCTS.filter(p => p.category === activeCategory));

    if (filteredProducts.length === 0) {
        gridEl.innerHTML = `<p class="text-center w-100" style="grid-column: 1/-1; color: var(--text-muted);">No products found in this category.</p>`;
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card glass-card";
        card.setAttribute("data-id", product.id);

        const rankBadge = product.rankLabel
            ? `<div class="product-rank-badge"><i class="fa-solid fa-award"></i> ${product.rankLabel}</div>`
            : (product.badges && product.badges[0] ? `<div class="product-rank-badge alt">${product.badges[0]}</div>` : "");
        const chipsHTML = (product.badges || []).slice(0, 3).map(b =>
            `<span class="product-chip">${b}</span>`).join("");

        card.innerHTML = `
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
                ${rankBadge}
            </div>
            <div class="product-info">
                <div class="product-rating">
                    <span class="stars-inline">${renderStars(product.rating)}</span>
                    <span class="rating-count">${ratingText(product)}</span>
                </div>
                <h3 class="product-name">${product.name}</h3>
                ${product.hook ? `<p class="product-hook">${product.hook}</p>` : ""}
                <div class="product-chips">${chipsHTML}</div>
                <div class="product-price-row">
                    <span class="product-price">$${product.price.toFixed(2)}</span>
                    <button class="btn-add-cart direct-add-btn" title="Add to Bag">
                        <i class="fa-solid fa-bag-shopping"></i> Add
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

        // 2. Open full-screen product view via Click
        card.querySelector(".product-name").addEventListener("click", () => pushView("product", product));
        card.querySelector(".view-details-btn").addEventListener("click", () => pushView("product", product));

        // 3. Add to Cart with default size (M, or first available)
        card.querySelectorAll(".btn-add-cart, .direct-add-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const defaultSize = product.sizes.includes("M") ? "M" : product.sizes[0];
                addToCart(product, defaultSize);
            });
        });

        gridEl.appendChild(card);
    });
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

    // Benefit bullets (what you GET) — the primary selling content.
    let benefitsHTML = "";
    if (product.benefits && product.benefits.length) {
        benefitsHTML = `<ul class="modal-benefits">` +
            product.benefits.map(b => `<li><i class="fa-solid fa-check"></i> ${b}</li>`).join("") +
            `</ul>`;
    }

    // Rank ribbon (real bestseller rank) sits above the title as top proof.
    const rankRibbon = product.rankLabel
        ? `<div class="modal-rank"><i class="fa-solid fa-award"></i> ${product.rankLabel}</div>` : "";

    productViewBody.innerHTML = `
        <div class="modal-img-wrapper">
            <img src="${product.image}" alt="${product.name}">
        </div>
        <div class="modal-details">
            <span class="product-category">${product.categoryLabel}</span>
            ${rankRibbon}
            <h2 class="modal-product-name">${product.name}</h2>
            <div class="modal-rating-row">
                <div class="stars">${renderStars(product.rating)}</div>
                <span class="reviews-count">${ratingText(product)}</span>
            </div>
            ${product.hook ? `<p class="modal-hook">${product.hook}</p>` : ""}
            <div class="modal-product-price">$${product.price.toFixed(2)}</div>
            ${benefitsHTML}

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

            ${product.description ? `<p class="modal-product-desc">${product.description}</p>` : ""}

            <div class="specs-grid">
                ${specsHTML}
            </div>

            <div class="modal-actions">
                <button class="btn btn-primary btn-add-modal glow-effect" id="modal-add-btn">
                    <i class="fa-solid fa-bag-shopping"></i> Add To Bag · $${product.price.toFixed(2)}
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
    const sizeGuideToggle = productViewBody.querySelector(".size-guide-toggle");
    const sizeGuidePanel = productViewBody.querySelector(".size-guide-panel");
    if (sizeGuideToggle && sizeGuidePanel) {
        sizeGuideToggle.addEventListener("click", () => {
            sizeGuidePanel.hidden = !sizeGuidePanel.hidden;
        });
    }

    // Hook size button selections
    const sizeBtns = productViewBody.querySelectorAll(".size-btn");
    let selectedSize = product.sizes.includes("M") ? "M" : (product.sizes[1] || product.sizes[0]);

    sizeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            sizeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedSize = btn.getAttribute("data-size");
        });
    });

    // Add To Bag — stay on the product view so the buyer can keep browsing.
    productViewBody.querySelector("#modal-add-btn").addEventListener("click", () => {
        addToCart(product, selectedSize);
    });
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
    setCartBadges(itemCount);
    cartSubtotalVal.innerText = `$${totalPrice.toFixed(2)}`;
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

// --- Checkout Handler ---
function handleCheckout() {
    const prefix = "GLZ";
    const num = Math.floor(100000 + Math.random() * 900000);
    orderRefCode.innerText = `#${prefix}-${num}`;

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

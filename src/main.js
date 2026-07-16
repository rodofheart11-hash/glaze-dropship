/* ==========================================================================
   GLAZE® Liquid Glass Clothing - Core Application State Engine
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
    updateCartUI();
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

    // Checkout Action
    checkoutBtn.addEventListener("click", () => {
        if (window.AYSzvothEK) {
            window.AYSzvothEK.track('checkout_started');
        }
        window.location.href = '/checkout';
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
        
        // Stars generation HTML
        let starsHTML = "";
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(product.rating)) {
                starsHTML += '<i class="fa-solid fa-star"></i>';
            } else if (i - 0.5 === product.rating) {
                starsHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
            } else {
                starsHTML += '<i class="fa-regular fa-star"></i>';
            }
        }

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
                    <span class="product-rating">
                        ${starsHTML}
                        <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 4px;">(${product.reviewsCount})</span>
                    </span>
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

        // 3. Add to Cart with Default Size "M"
        card.querySelectorAll(".direct-add-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                addToCart(product, "M");
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
    let sizesHTML = "";
    product.sizes.forEach((size, index) => {
        sizesHTML += `
            <button class="size-btn ${index === 1 ? 'active' : ''}" data-size="${size}">
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
            <div class="modal-product-price">$${product.price.toFixed(2)}</div>
            <p class="modal-product-desc">${product.description}</p>
            
            <div class="specs-grid">
                ${specsHTML}
            </div>

            <h4>Select Size</h4>
            <div class="size-selector" id="modal-size-selector">
                ${sizesHTML}
            </div>

            <div class="modal-actions">
                <button class="btn btn-primary btn-add-modal glow-effect" id="modal-add-btn">
                    <span>Add to Shopping Bag</span>
                    <i class="fa-solid fa-bag-shopping"></i>
                </button>
            </div>
        </div>
    `;

    // Hook size button selections
    const sizeBtns = modalProductDetails.querySelectorAll(".size-btn");
    let selectedSize = product.sizes[1]; // default size index 1 ("M")

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

// --- Cart Logic ---
function addToCart(product, size) {
    if (window.AYSzvothEK) {
        window.AYSzvothEK.track('AddToCart', {
            id: product.id,
            name: product.name,
            price: product.price,
            size: size
        });
    }
    const existingIndex = cart.findIndex(item => item.product.id === product.id && item.size === size);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
    } else {
        cart.push({
            product: product,
            size: size,
            quantity: 1
        });
    }

    updateCartUI();
    showToast(`Added ${product.name} (${size}) to bag.`, "fa-bag-shopping");
}

function updateCartUI() {
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

    let subtotal = 0;
    let totalItemsCount = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.product.price * item.quantity;
        subtotal += itemTotal;
        totalItemsCount += item.quantity;

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
                        <button class="qty-btn dec-qty-btn" data-index="${index}">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn inc-qty-btn" data-index="${index}">+</button>
                    </div>
                    <button class="btn-remove-item" data-index="${index}" title="Remove Item">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;

        // Handle quantity decrement
        cartItemEl.querySelector(".dec-qty-btn").addEventListener("click", () => {
            if (item.quantity > 1) {
                item.quantity -= 1;
            } else {
                cart.splice(index, 1);
            }
            updateCartUI();
        });

        // Handle quantity increment
        cartItemEl.querySelector(".inc-qty-btn").addEventListener("click", () => {
            item.quantity += 1;
            updateCartUI();
        });

        // Handle item deletion
        cartItemEl.querySelector(".btn-remove-item").addEventListener("click", () => {
            cart.splice(index, 1);
            updateCartUI();
        });

        cartItemsContainer.appendChild(cartItemEl);
    });

    // Update Badge
    cartBadge.innerText = totalItemsCount;
    cartBadge.classList.add("active");

    // Update Subtotal
    cartSubtotalVal.innerText = `$${subtotal.toFixed(2)}`;
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

// CONFIG
const CONFIG = {
    SOURCE_ID: "cmrmurz1i000edtnrb55ig6b7",
    ENDPOINT: "https://s1.rbrun.com/api/conversion",
    HEARTBEAT_ENDPOINT: "https://s1.rbrun.com/api/heartbeat",
    STORAGE_KEY: "_rb_vid"
};

// Retrieves visitor ID from sandbox browser storage
async function getVid() {
    let vid = null;
    try {
        vid = await browser.localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!vid) {
            vid = await browser.cookie.get(CONFIG.STORAGE_KEY);
        }
    } catch (e) {
        // Fail silently
    }
    return vid;
}

// Sends data via sendBeacon (preferred) or fetch fallback
async function sendData(endpoint, payload) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

    if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, blob);
    } else {
        fetch(endpoint, {
            method: 'POST',
            body: blob,
            keepalive: true,
            credentials: 'omit'
        }).catch(() => { });
    }
}

function extractMeta(checkout) {
    const customer = checkout.customer || (checkout.order ? checkout.order.customer : null);
    return {
        customer_id: customer?.id || null,
        first_order: customer?.isFirstOrder || false,
        shipping: checkout.shippingLine?.price?.amount || 0,
        variants: (checkout.lineItems || []).map(item => item.variant?.id).filter(Boolean)
    };
}

async function trackHeartbeat(event, eventName) {
    const vid = await getVid();
    const payload = {
        vid: vid,
        source_id: CONFIG.SOURCE_ID,
        event_name: eventName,
        url: event.context.window.location.href
    };
    await sendData(CONFIG.HEARTBEAT_ENDPOINT, payload);
}

// Conversion tracking
analytics.subscribe("checkout_completed", async (event) => {
    const checkout = event.data.checkout;
    if (!checkout) return;

    const vid = await getVid();
    const payload = {
        vid: vid,
        source_id: CONFIG.SOURCE_ID,
        order_id: checkout.order.id,
        order_number: checkout.order.name || checkout.order.id,
        order_total_cents: Math.round(parseFloat(checkout.totalPrice.amount) * 100),
        currency: checkout.currencyCode,
        meta: extractMeta(checkout)
    };

    await sendData(CONFIG.ENDPOINT, payload);
});

// Heartbeat events
analytics.subscribe("checkout_started", (event) => trackHeartbeat(event, "checkout_started"));
analytics.subscribe("page_viewed", (event) => trackHeartbeat(event, "page_viewed"));
analytics.subscribe("product_viewed", (event) => trackHeartbeat(event, "product_viewed"));
analytics.subscribe("collection_viewed", (event) => trackHeartbeat(event, "collection_viewed"));
analytics.subscribe("cart_viewed", (event) => trackHeartbeat(event, "cart_viewed"));

// Custom event fallback handlers for AJAX single-page storefront actions
analytics.subscribe("custom_cart_viewed", (event) => trackHeartbeat(event, "cart_viewed"));
analytics.subscribe("custom_product_viewed", (event) => trackHeartbeat(event, "product_viewed"));
analytics.subscribe("custom_collection_viewed", (event) => trackHeartbeat(event, "collection_viewed"));

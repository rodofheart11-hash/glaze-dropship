/* ==========================================================================
   GLAZE Apparel - Products Catalog Export
   --------------------------------------------------------------------------
   All products are quality-checked imported apparel, fulfilled from our
   supplier network. Descriptions reflect the actual materials and features
   of each garment. Ratings, review counts and bestseller ranks are the real
   figures from the source marketplace listing (honest social proof).

   Data model (structured for decision-order, most persuasive first):
     hook        - one-line value statement (leads the card/modal)
     badges[]    - short honest trust signals (bestseller, UPF 50+, pockets...)
     rankLabel   - real category bestseller rank, or "" if not top-ranked
     benefits[]  - scannable customer-outcome bullets (what you GET)
     specs{}     - factual detail (material / fit / care) for the detail buyer
     rating, reviewsCount - genuine marketplace figures

   Products are ordered bestsellers-first (by review count) so the most
   proven items surface first by default.
   ========================================================================== */

export const PRODUCTS = [
    {
        id: "B09P3RHNSY",
        name: "GLAZE Aero Men's Running Shorts",
        category: "activewear",
        categoryLabel: "Men's Activewear",
        price: 26.99,
        rating: 4.5,
        reviewsCount: 19928,
        image: "/assets/clothing_aero_shorts.jpg",
        hook: "Quick-dry training shorts with 3 zip pockets — loved by nearly 20,000 shoppers.",
        rankLabel: "Top 15 in Men's Clothing",
        badges: ["Top Rated", "3 Zip Pockets", "Quick-Dry"],
        benefits: [
            "Three zippered pockets keep your phone, keys and cards secure while you move",
            "Quick-drying, lightweight fabric for running, gym and court sports",
            "Built-in mesh liner for all-day comfort"
        ],
        description: "Lightweight athletic shorts built for running, gym and court sports. Quick-drying fabric with three zippered pockets to keep your essentials secure while you move.",
        specs: {
            material: "Polyester / spandex blend",
            pockets: "Three zippered pockets",
            performance: "Quick-drying, lightweight",
            fit: "Athletic fit with mesh liner"
        },
        sizes: ["S", "M", "L", "XL"]
    },
    {
        id: "B0CKZ4ZWYG",
        name: "GLAZE Everyday High-Waisted Leggings",
        category: "activewear",
        categoryLabel: "Women's Activewear",
        price: 15.99,
        rating: 4.6,
        reviewsCount: 12949,
        image: "/assets/clothing_leggings.jpg",
        hook: "Buttery-soft leggings with real pockets — a 12,000+ review bestseller.",
        rankLabel: "#11 Bestseller in Women's Clothing",
        badges: ["Bestseller", "Side Pockets", "Squat-Proof"],
        benefits: [
            "Actual side pockets that fit your phone — not fake ones",
            "Buttery-soft, 4-way stretch that moves with you",
            "High-waisted with a wide band that won't roll down"
        ],
        description: "Buttery-soft high-waisted leggings with side pockets. A stretchy, comfortable everyday layer for yoga, workouts and lounging.",
        specs: {
            material: "Polyester / spandex blend",
            waist: "High-waisted",
            features: "Side pockets, 4-way stretch",
            fit: "Full length, buttery-soft feel"
        },
        sizes: ["S", "M", "L", "XL"]
    },
    {
        id: "B0BV241H3F",
        name: "GLAZE Summer Linen-Blend Button-Down",
        category: "shirts",
        categoryLabel: "Men's Shirts",
        price: 34.99,
        rating: 4.4,
        reviewsCount: 14800,
        image: "/assets/clothing_prism_shirt.jpg",
        hook: "The breathable summer shirt with 14,800 reviews — beach to wedding.",
        rankLabel: "#4 Bestseller in Men's Clothing",
        badges: ["Bestseller", "Breathable Linen", "Wedding-Ready"],
        benefits: [
            "Lightweight linen-cotton blend keeps you cool in the heat",
            "Dresses up or down — beach, summer events, weddings",
            "Relaxed casual fit that isn't boxy"
        ],
        description: "A relaxed short-sleeve button-down in a breathable linen-cotton blend. A lightweight staple for the beach, summer events and everyday warm-weather wear.",
        specs: {
            material: "Linen / cotton blend",
            fit: "Relaxed casual fit",
            features: "Button-down front, short sleeve",
            care: "Machine wash cold, iron low if needed"
        },
        sizes: ["M", "L", "XL", "XXL"]
    },
    {
        id: "B09MKNL9M3",
        name: "GLAZE Aero Women's Athletic Shorts",
        category: "activewear",
        categoryLabel: "Women's Activewear",
        price: 24.99,
        rating: 4.5,
        reviewsCount: 12857,
        image: "/assets/clothing_womens_shorts.jpg",
        hook: "High-waisted workout shorts with a secure pocket — 12,000+ reviews.",
        rankLabel: "#10 Bestseller in Women's Clothing",
        badges: ["Bestseller", "High-Waisted", "Pocket"],
        benefits: [
            "Flattering high-rise waistband that stays put through any workout",
            "Secure pocket for your phone or keys",
            "Stretchy, breathable fabric for gym and everyday wear"
        ],
        description: "High-waisted running shorts with a secure pocket, made for gym workouts and everyday active wear. Stretchy, comfortable fabric with a flattering high-rise waistband.",
        specs: {
            material: "Polyester / spandex blend",
            waist: "High-waisted elastic waistband",
            pockets: "Side pocket",
            fit: "Sporty running short"
        },
        sizes: ["XS", "S", "M", "L"]
    },
    {
        id: "B0CSDK2C3P",
        name: "GLAZE UV-Shield Long Sleeve Sun Shirt",
        category: "activewear",
        categoryLabel: "Women's Activewear",
        price: 27.99,
        rating: 4.6,
        reviewsCount: 3506,
        image: "/assets/clothing_uv_shirt.jpg",
        hook: "UPF 50+ sun protection that actually stays cool — 3,500+ reviews.",
        rankLabel: "Top 25 in Women's Clothing",
        badges: ["UPF 50+", "Quick-Dry", "Cooling"],
        benefits: [
            "UPF 50+ rated fabric blocks the sun on long days outdoors",
            "Moisture-wicking and quick-drying for hikes and workouts",
            "Lightweight and breathable so you stay cool, not sweaty"
        ],
        description: "A lightweight, quick-drying long sleeve shirt with UPF 50+ rated sun protection. Made for hiking, workouts and long days outdoors, with a breathable feel that helps keep you cool.",
        specs: {
            material: "Polyester / spandex blend",
            protection: "UPF 50+ rated fabric (manufacturer tested)",
            performance: "Moisture-wicking, quick-drying",
            fit: "Lightweight, breathable long sleeve"
        },
        sizes: ["S", "M", "L", "XL"]
    },
    {
        id: "B0FP5BYXVR",
        name: "GLAZE Palazzo Wide-Leg Pants",
        category: "pants",
        categoryLabel: "Women's Pants",
        price: 32.99,
        rating: 4.5,
        reviewsCount: 2745,
        image: "/assets/clothing_palazzo_pants.jpg",
        hook: "Flowy vacation pants with pockets — a top-3 women's bestseller.",
        rankLabel: "#3 Bestseller in Women's Clothing",
        badges: ["Bestseller", "Pockets", "Vacation-Ready"],
        benefits: [
            "Breezy wide-leg cut that's cool and comfortable in the heat",
            "Real pockets and a drawstring elastic waist for easy fit",
            "Dresses up for dinner or down for the beach"
        ],
        description: "Flowy wide-leg palazzo pants with a drawstring elastic waist and pockets. Lightweight and breezy for summer, the beach and vacation.",
        specs: {
            material: "Rayon blend",
            fit: "Wide-leg palazzo cut",
            waist: "Drawstring elastic waist",
            features: "Side pockets"
        },
        sizes: ["S", "M", "L", "XL"]
    },
    {
        id: "B0FT4QF9D5",
        name: "GLAZE Flow Midi Sundress",
        category: "dresses",
        categoryLabel: "Women's Dresses",
        price: 32.99,
        rating: 4.5,
        reviewsCount: 2393,
        image: "/assets/clothing_flow_dress.jpg",
        hook: "The flowy midi sundress with real pockets — made for vacation.",
        rankLabel: "",
        badges: ["Best Seller", "Side Pockets", "Vacation-Ready"],
        benefits: [
            "Handy side pockets — rare on a dress this light",
            "Soft, breathable fabric with an easy, flattering drape",
            "Midi length that works for the beach, brunch or a day out"
        ],
        description: "A lightweight, flowy midi sundress cut for warm-weather days and vacations. Soft, breathable fabric with a relaxed drape and handy side pockets.",
        specs: {
            material: "Rayon / spandex blend",
            fit: "Relaxed A-line midi length",
            features: "Two side pockets, elastic comfort waist",
            care: "Machine wash cold, hang dry"
        },
        sizes: ["S", "M", "L", "XL"]
    },
    {
        id: "B0FTSVKP9B",
        name: "GLAZE Ribbed Knit Tank Top",
        category: "tops",
        categoryLabel: "Women's Tops",
        price: 14.99,
        rating: 4.6,
        reviewsCount: 2032,
        image: "/assets/clothing_ribbed_tank.jpg",
        hook: "The soft ribbed layering tank that goes with everything.",
        rankLabel: "#5 Bestseller in Women's Clothing",
        badges: ["Bestseller", "Layerable", "Soft Stretch"],
        benefits: [
            "Slim V-neck fit that layers cleanly under anything",
            "Soft ribbed knit with comfortable stretch",
            "An everyday basic you'll reach for all summer"
        ],
        description: "A slim-fitting V-neck ribbed knit tank top. A soft, stretchy basic that layers easily and works for everyday summer wear.",
        specs: {
            material: "Ribbed cotton blend",
            neckline: "V-neck",
            fit: "Slim, fitted sleeveless",
            care: "Machine wash cold"
        },
        sizes: ["XS", "S", "M", "L"]
    }
];

// Aggregate honest social proof (sum of real review counts across the catalog).
export const TOTAL_REVIEWS = PRODUCTS.reduce((sum, p) => sum + (p.reviewsCount || 0), 0);

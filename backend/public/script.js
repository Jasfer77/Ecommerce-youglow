if (location.pathname === "/index.html") {
    history.replaceState(null, "", `/${location.search}${location.hash}`);
}

const header = document.querySelector(".site-header");
const landingCartCount = document.querySelector("#landingCartCount");
const landingCartDrawer = document.querySelector("#landingCartDrawer");
const landingCartBackdrop = document.querySelector("#landingCartBackdrop");
let landingProducts = [];
const landingMoney = (value) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
    }).format(value);
function getLandingCart() {
    try {
        return JSON.parse(localStorage.getItem("yg-cart") || "{}") || {};
    } catch (_) {
        return {};
    }
}
function landingArtwork(product) {
    if (product?.imageUrl) return product.imageUrl;
    const name = (product?.name || "").toLowerCase();
    if (name.includes("tirzepatide"))
        return name.includes("30")
            ? "assets/landing/tirzepatide-30mg.jpg"
            : "assets/landing/tirzepatide-15mg.jpg";
    if (name.includes("ghk")) return "assets/landing/ghk-cu-50mg.jpg";
    if (name.includes("nad")) return "assets/landing/nad-50mg.jpg";
    return "assets/landing/ghk-cu-50mg.jpg";
}
function refreshLandingCartCount() {
    if (!landingCartCount) return;
    const cart = getLandingCart();
    const count = Object.values(cart).reduce(
        (sum, quantity) => sum + Number(quantity || 0),
        0,
    );
    landingCartCount.textContent = count;
    landingCartCount.hidden = count === 0;
}
function saveLandingCart(cart) {
    localStorage.setItem("yg-cart", JSON.stringify(cart));
    refreshLandingCartCount();
    renderLandingCart();
}
function renderLandingCart() {
    const host = document.querySelector("#landingCartItems");
    if (!host) return;
    const cart = getLandingCart();
    let total = 0;
    const rows = Object.entries(cart)
        .map(([id, quantity]) => {
            const product = landingProducts.find(
                (item) => String(item.id) === String(id),
            );
            if (!product) return "";
            total += Number(product.price) * Number(quantity);
            return `<article class="landing-cart-row"><img src="${landingArtwork(product)}" alt=""><div><h3>${product.name}</h3><p>${landingMoney(product.price)}</p><div class="landing-cart-quantity"><button data-landing-dec="${id}" aria-label="Decrease quantity">−</button><span>${quantity}</span><button data-landing-inc="${id}" aria-label="Increase quantity">+</button></div></div><button class="landing-cart-remove" data-landing-remove="${id}" aria-label="Remove ${product.name}">×</button></article>`;
        })
        .join("");
    host.innerHTML =
        rows ||
        '<div class="landing-cart-empty"><strong>Your ritual awaits</strong><span>Your bag is currently empty.</span></div>';
    document.querySelector("#landingCartSubtotal").textContent =
        landingMoney(total);
    host.querySelectorAll("[data-landing-inc]").forEach(
        (button) =>
            (button.onclick = () => {
                const next = getLandingCart();
                next[button.dataset.landingInc] =
                    Number(next[button.dataset.landingInc] || 0) + 1;
                saveLandingCart(next);
            }),
    );
    host.querySelectorAll("[data-landing-dec]").forEach(
        (button) =>
            (button.onclick = () => {
                const next = getLandingCart();
                const id = button.dataset.landingDec;
                next[id] = Number(next[id] || 0) - 1;
                if (next[id] <= 0) delete next[id];
                saveLandingCart(next);
            }),
    );
    host.querySelectorAll("[data-landing-remove]").forEach(
        (button) =>
            (button.onclick = () => {
                const next = getLandingCart();
                delete next[button.dataset.landingRemove];
                saveLandingCart(next);
            }),
    );
}
function toggleLandingCart(open) {
    landingCartDrawer.classList.toggle("open", open);
    landingCartBackdrop.classList.toggle("open", open);
    landingCartDrawer.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) renderLandingCart();
}
refreshLandingCartCount();
fetch("/api/products")
    .then((response) => (response.ok ? response.json() : []))
    .then((data) => {
        landingProducts = Array.isArray(data) ? data : [];
        renderLandingCart();
    })
    .catch(() => {});
window.addEventListener("storage", () => {
    refreshLandingCartCount();
    renderLandingCart();
});
document
    .querySelector("#landingCartTrigger")
    ?.addEventListener("click", () => toggleLandingCart(true));
document
    .querySelector("#landingCartClose")
    ?.addEventListener("click", () => toggleLandingCart(false));
landingCartBackdrop?.addEventListener("click", () => toggleLandingCart(false));

const productInformation = {
    "tirzepatide-15": {
        title: "Tirzepatide 15mg",
        category: "Weight management",
        image: "assets/landing/tirzepatide-15mg.jpg",
        description:
            "Tirzepatide activates GIP and GLP-1 hormone receptors involved in appetite regulation, food intake, and blood glucose control. It supports weight management in eligible adults alongside lifestyle changes.",
        benefits: [
            "Supports weight loss",
            "Helps regulate appetite",
            "May increase feelings of fullness",
            "Helps reduce food intake",
            "Improves blood sugar control in type 2 diabetes",
            "Supports long-term weight management",
        ],
    },
    "tirzepatide-30": {
        title: "Tirzepatide 30mg",
        category: "Weight management",
        image: "assets/landing/tirzepatide-30mg.jpg",
        description:
            "Tirzepatide activates GIP and GLP-1 hormone receptors involved in appetite regulation, food intake, and blood glucose control. It supports weight management in eligible adults alongside lifestyle changes.",
        benefits: [
            "Supports weight loss",
            "Helps regulate appetite",
            "May increase feelings of fullness",
            "Helps reduce food intake",
            "Improves blood sugar control in type 2 diabetes",
            "Supports long-term weight management",
        ],
    },
    "ghk-cu": {
        title: "GHK-Cu",
        category: "Skin & beauty",
        image: "assets/landing/ghk-cu-50mg.jpg",
        description:
            "GHK-Cu is a copper-binding peptide studied for its potential role in skin biology, collagen-related processes, and tissue repair.",
        benefits: [
            "Collagen-related processes",
            "Skin firmness and elasticity",
            "Skin texture and appearance",
            "Tissue repair processes",
            "Antioxidant activity",
            "Skin health and visible signs of aging",
        ],
    },
    nad: {
        title: "NAD+",
        category: "Anti-Aging & Cellular wellness",
        image: "assets/landing/nad-50mg.jpg",
        description:
            "NAD+ is a coenzyme essential for cellular energy metabolism and normal cell function. Its potential applications in cellular health and aging.",
        benefits: [
            "Cellular energy metabolism",
            "Normal cell function",
            "Metabolic processes",
            "DNA repair pathways",
            "Cellular stress responses",
            "Healthy aging research"
        ],
    },
};
const productInfoBackdrop = document.querySelector("#productInfoBackdrop");
function toggleProductInformation(key) {
    const info = productInformation[key];
    const open = Boolean(info);
    if (open) {
        document.querySelector("#productInfoCategory").textContent =
            info.category;
        document.querySelector("#productInfoTitle").textContent = info.title;
        document.querySelector("#productInfoDescription").textContent =
            info.description;
        document.querySelector("#productInfoImage").src = info.image;
        document.querySelector("#productInfoImage").alt =
            `${info.title} product`;
        document.querySelector("#productInfoBenefits").innerHTML = info.benefits
            .map((benefit) => `<li>${benefit}</li>`)
            .join("");
    }
    productInfoBackdrop.classList.toggle("open", open);
    productInfoBackdrop.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    document.body.style.transform = open ? "none" : "";
}
document.querySelectorAll("[data-product-info]").forEach((link) =>
    link.addEventListener("click", (event) => {
        event.preventDefault();
        toggleProductInformation(link.dataset.productInfo);
    }),
);
document
    .querySelector("#productInfoClose")
    ?.addEventListener("click", () => toggleProductInformation());
productInfoBackdrop?.addEventListener("click", (event) => {
    if (event.target === productInfoBackdrop) toggleProductInformation();
});
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        productInfoBackdrop?.classList.contains("open")
    )
        toggleProductInformation();
});
const faqModal = document.querySelector("#faqModal");
const faqModalList = document.querySelector("#faqModalList");
function toggleFaqModal(open) {
    if (open && !faqModalList.children.length) {
        const source = document.querySelector("#faqContentSource .faq-list");
        faqModalList.innerHTML = source?.innerHTML || "";
    }
    faqModal.classList.toggle("open", open);
    faqModal.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    document.body.style.transform = open ? "none" : "";
}
document.querySelectorAll("[data-open-faq]").forEach((link) =>
    link.addEventListener("click", (event) => {
        event.preventDefault();
        toggleFaqModal(true);
    }),
);
document
    .querySelector("#faqModalClose")
    ?.addEventListener("click", () => toggleFaqModal(false));
faqModal?.addEventListener("click", (event) => {
    if (event.target === faqModal) toggleFaqModal(false);
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && faqModal?.classList.contains("open"))
        toggleFaqModal(false);
});
const aboutDetails = document.querySelector(".about-copy");
window.toggleAboutDetails = function (open) {
    aboutDetails?.classList.toggle("mobile-open", open);
    aboutDetails?.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
};
document
    .querySelector("#aboutDetailsTrigger")
    ?.addEventListener("click", () => window.toggleAboutDetails(true));
document
    .querySelector("#aboutDetailsClose")
    ?.addEventListener("click", () => window.toggleAboutDetails(false));
aboutDetails?.addEventListener("click", (event) => {
    if (event.target === aboutDetails) window.toggleAboutDetails(false);
});
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        aboutDetails?.classList.contains("mobile-open")
    )
        window.toggleAboutDetails(false);
});
const menu = document.querySelector(".menu-button");

menu.addEventListener("click", () => {
    const open = header.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll(".site-header nav a").forEach((link) => {
    link.addEventListener("click", () => {
        header.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
    });
});

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.12 },
);

document
    .querySelectorAll(".product-tile,.trust-grid article,.about-contact")
    .forEach((element) => element.classList.add("reveal"));
document
    .querySelectorAll(".reveal")
    .forEach((element) => observer.observe(element));
document.querySelector("#year").textContent = new Date().getFullYear();

const feedbackHost = document.querySelector("#customerFeedback");
const safeFeedbackText = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            })[character],
    );
const feedbackCard = (item, expanded = false) =>
    `<article class="customer-feedback-card${expanded ? " expanded-review" : " reveal"}"><span class="feedback-stars" aria-label="${item.rating} out of 5 stars">★ ${Number(item.rating).toFixed(1)}</span>${item.photos?.length ? `<div class="public-feedback-photos">${item.photos.slice(0, 3).map((url, index) => `<a href="${safeFeedbackText(url)}" target="_blank" rel="noopener"><img src="${safeFeedbackText(url)}" alt="Customer review photo ${index + 1}" loading="lazy"></a>`).join("")}</div>` : ""}<blockquote>“${safeFeedbackText(item.comment)}”</blockquote><footer><strong>${safeFeedbackText(item.customer)}</strong><small>${safeFeedbackText(item.date || "Verified customer")}</small></footer></article>`;
fetch("/api/feedback")
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then((feedback) => {
        if (!feedbackHost) return;
        if (!feedback.length) {
            feedbackHost.innerHTML =
                '<article class="feedback-empty"><span>♡</span><h3>Share your experience</h3><p>Approved customer feedback will appear here.</p></article>';
            return;
        }
        feedbackHost.innerHTML = feedback
            .slice(0, 3)
            .map(
                (item) => feedbackCard(item),
            )
            .join("");
        feedbackHost
            .querySelectorAll(".reveal")
            .forEach((element) => observer.observe(element));
    })
    .catch(() => {
        if (feedbackHost)
            feedbackHost.innerHTML =
                '<article class="feedback-empty"><span>♡</span><h3>Customer feedback</h3><p>Feedback is temporarily unavailable.</p></article>';
    });

const reviewsDialog = document.querySelector("#reviewsDialog");
const viewAllReviews = document.querySelector("#viewAllReviews");
const allCustomerReviews = document.querySelector("#allCustomerReviews");
if (reviewsDialog && viewAllReviews && allCustomerReviews) {
    viewAllReviews.addEventListener("click", async () => {
        reviewsDialog.showModal();
        allCustomerReviews.innerHTML = "<p class=\"reviews-loading\">Loading customer reviews…</p>";
        try {
            const response = await fetch("/api/feedback?all=1", { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error();
            const reviews = await response.json();
            allCustomerReviews.innerHTML = reviews.length
                ? reviews.map((review) => feedbackCard(review, true)).join("")
                : '<p class="reviews-loading">No approved customer reviews yet.</p>';
        } catch (_) {
            allCustomerReviews.innerHTML = '<p class="reviews-loading">Reviews are temporarily unavailable. Please try again.</p>';
        }
    });
    document.querySelector("#closeReviewsDialog").addEventListener("click", () => reviewsDialog.close());
    reviewsDialog.addEventListener("click", (event) => {
        if (event.target === reviewsDialog) reviewsDialog.close();
    });
}

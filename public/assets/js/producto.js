/** Detalle de producto: variantes, cantidad, agregar al carrito y reseñas.
 *  Externalizado por CSP estricta (sin 'unsafe-inline'). */

// ── Acciones del producto (variantes, cantidad, carrito) ──────────────────────
function initProductActions() {
  const actions = document.getElementById("productActions");
  if (!actions || actions.dataset.jsInit) return;
  actions.dataset.jsInit = "1";

  const productId = actions.dataset.productId;
  const name = actions.dataset.productName;
  const image = actions.dataset.productImage;
  let price = parseInt(actions.dataset.productPrice, 10);

  const qtyInput = document.getElementById("qtyInput");
  const qtyDown = document.getElementById("qtyDown");
  const qtyUp = document.getElementById("qtyUp");
  const addBtn = document.getElementById("addToCartBtn");
  const priceEl = document.querySelector(".price-cop");

  // Variantes
  const variantsWrap = document.getElementById("variantsWrap");
  let selectedSize = null;
  let selectedGrind = null;

  function findVariant(variants) {
    return (
      variants.find(
        (v) =>
          (!v.size_label || v.size_label === selectedSize) &&
          (!v.grind_label || v.grind_label === selectedGrind)
      ) ?? null
    );
  }

  function updatePrice(variants) {
    const v = findVariant(variants);
    const p = v ? v.price_cop : parseInt(actions.dataset.productPrice, 10);
    price = p;
    if (priceEl) priceEl.textContent = "$" + p.toLocaleString("es-CO");
    const outOfStock = v ? v.stock_quantity === 0 : false;
    addBtn.disabled = outOfStock;
    addBtn.textContent = outOfStock ? "Agotado" : "Agregar al carrito";
  }

  function activateBtn(group, value, attr) {
    group.querySelectorAll(".variant-btn").forEach((b) => b.classList.remove("active"));
    const target = group.querySelector(`[${attr}="${value}"]`);
    if (target) target.classList.add("active");
  }

  if (variantsWrap) {
    const variants = JSON.parse(variantsWrap.dataset.variants || "[]");
    const sizeGroup = document.getElementById("variantSize");
    const grindGroup = document.getElementById("variantGrind");

    if (sizeGroup) {
      sizeGroup.addEventListener("click", (e) => {
        const btn = e.target.closest(".variant-btn");
        if (!btn) return;
        selectedSize = btn.dataset.size || null;
        activateBtn(sizeGroup, selectedSize, "data-size");
        updatePrice(variants);
      });
      const first = sizeGroup.querySelector(".variant-btn");
      if (first) {
        selectedSize = first.dataset.size || null;
        first.classList.add("active");
      }
    }

    if (grindGroup) {
      grindGroup.addEventListener("click", (e) => {
        const btn = e.target.closest(".variant-btn");
        if (!btn) return;
        selectedGrind = btn.dataset.grind || null;
        activateBtn(grindGroup, selectedGrind, "data-grind");
        updatePrice(variants);
      });
      const first = grindGroup.querySelector(".variant-btn");
      if (first) {
        selectedGrind = first.dataset.grind || null;
        first.classList.add("active");
      }
    }

    updatePrice(variants);
  }

  // Cantidad
  function getQty() {
    return Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
  }

  qtyDown.addEventListener("click", () => {
    const q = getQty();
    if (q > 1) qtyInput.value = String(q - 1);
  });
  qtyUp.addEventListener("click", () => {
    const q = getQty();
    const max = parseInt(qtyInput.max, 10) || 99;
    if (q < max) qtyInput.value = String(q + 1);
  });

  // Agregar al carrito
  addBtn.addEventListener("click", () => {
    function tryAdd() {
      if (!window.Cart) {
        setTimeout(tryAdd, 40);
        return;
      }
      const qty = getQty();
      const variantSuffix = [selectedSize, selectedGrind].filter(Boolean).join(" · ");
      const itemName = variantSuffix ? `${name} — ${variantSuffix}` : name;
      window.Cart.addToCart({ id: productId, name: itemName, price, image, qty });
      addBtn.textContent = "✓ Agregado";
      addBtn.disabled = true;
      setTimeout(() => {
        addBtn.textContent = "Agregar al carrito";
        addBtn.disabled = false;
      }, 1500);
    }
    tryAdd();
  });
})();

// ── Reseñas ───────────────────────────────────────────────────────────────────
(function () {
  const section = document.getElementById("reviewsSection");
  if (!section) return;
  const productId = section.dataset.productId;

  const avgEl = document.getElementById("reviewsAvg");
  const starsEl = document.getElementById("reviewsStars");
  const countEl = document.getElementById("reviewsCount");
  const listEl = document.getElementById("reviewsList");
  const emptyEl = document.getElementById("reviewsEmpty");
  const form = document.getElementById("reviewForm");
  const msgEl = document.getElementById("reviewMsg");
  const submitBtn = document.getElementById("reviewSubmit");

  let selectedRating = 0;
  const starPicker = document.getElementById("starPicker");
  if (starPicker) {
    starPicker.addEventListener("click", (e) => {
      const btn = e.target.closest(".star-btn");
      if (!btn) return;
      selectedRating = parseInt(btn.dataset.val, 10);
      starPicker.querySelectorAll(".star-btn").forEach((b, i) => {
        b.classList.toggle("active", i < selectedRating);
      });
    });
  }

  function renderStars(avg) {
    const full = Math.round(avg);
    return "★".repeat(full) + "☆".repeat(5 - full);
  }

  async function loadReviews() {
    try {
      const res = await fetch(`/api/products/${productId}/reviews`);
      const { data } = await res.json();
      if (data.avg_rating && avgEl) {
        avgEl.textContent = Number(data.avg_rating).toFixed(1);
        if (starsEl) starsEl.textContent = renderStars(data.avg_rating);
        if (countEl) countEl.textContent = `(${data.total} reseña${data.total !== 1 ? "s" : ""})`;
      }
      if (!data.reviews.length) {
        if (emptyEl) emptyEl.style.display = "block";
        return;
      }
      if (emptyEl) emptyEl.style.display = "none";
      const cards = data.reviews
        .map((r) => {
          const d = new Date(r.created_at).toLocaleDateString("es-CO");
          return `<div class="review-card">
              <div class="review-card__header">
                <strong>${r.reviewer_name}</strong>
                <span class="review-card__stars" style="color:#f59e0b">${renderStars(r.rating)}</span>
                <span class="review-card__date">${d}</span>
              </div>
              ${r.comment ? `<p class="review-card__comment">${r.comment}</p>` : ""}
            </div>`;
        })
        .join("");
      if (listEl) listEl.insertAdjacentHTML("afterbegin", cards);
    } catch (e) {
      console.warn("No se pudieron cargar reseñas", e);
    }
  }
  loadReviews();

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("revName").value.trim();
      const comment = document.getElementById("revComment").value.trim();
      if (!name || !selectedRating) {
        if (msgEl) {
          msgEl.textContent = "Por favor complete su nombre y calificación.";
          msgEl.className = "review-msg error";
          msgEl.style.display = "block";
        }
        return;
      }
      submitBtn.disabled = true;
      try {
        const res = await fetch(`/api/products/${productId}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reviewer_name: name, rating: selectedRating, comment }),
        });
        const data = await res.json();
        if (msgEl) {
          msgEl.textContent = data.message || "¡Gracias! Su reseña está en revisión.";
          msgEl.className = "review-msg success";
          msgEl.style.display = "block";
        }
        form.reset();
        selectedRating = 0;
        starPicker?.querySelectorAll(".star-btn").forEach((b) => b.classList.remove("active"));
      } catch {
        if (msgEl) {
          msgEl.textContent = "Error al enviar. Inténtelo de nuevo.";
          msgEl.className = "review-msg error";
          msgEl.style.display = "block";
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
})();

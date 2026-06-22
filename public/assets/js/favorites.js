// Favoritos / lista de deseos — helper global de cliente.
// Comentarios en espanol sin tildes para consistencia con el resto de /js.
(function () {
  let cache = null;        // Set de product_id favoritos del usuario, null si no cargado
  let loadPromise = null;  // evita cargas duplicadas en paralelo

  // Carga (una sola vez) los favoritos del usuario autenticado.
  // Si no hay sesion devuelve un Set vacio sin redirigir.
  async function load() {
    if (cache) return cache;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const res = await fetch('/api/account/favorites', { credentials: 'include' });
        if (!res.ok) { cache = new Set(); return cache; }
        const json = await res.json();
        const ids = (json && json.data ? json.data : []).map((f) => f.product_id);
        cache = new Set(ids);
      } catch {
        cache = new Set();
      }
      return cache;
    })();
    return loadPromise;
  }

  function isFav(productId) {
    return !!cache && cache.has(productId);
  }

  async function add(productId) {
    const res = await fetch('/api/account/favorites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    if (res.status === 401) return { unauthenticated: true };
    if (res.ok && cache) cache.add(productId);
    return { ok: res.ok };
  }

  async function remove(productId) {
    const res = await fetch('/api/account/favorites/' + encodeURIComponent(productId), {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.status === 401) return { unauthenticated: true };
    if (res.ok && cache) cache.delete(productId);
    return { ok: res.ok };
  }

  // Alterna el estado y devuelve el nuevo valor (true = ahora favorito).
  async function toggle(productId) {
    const result = isFav(productId) ? await remove(productId) : await add(productId);
    if (result.unauthenticated) {
      location.href = '/login?next=' + encodeURIComponent(location.pathname);
      return null;
    }
    return isFav(productId);
  }

  // Marca visualmente todos los botones [data-fav] de la pagina segun el estado cargado.
  function syncButtons(root) {
    (root || document).querySelectorAll('[data-fav]').forEach((btn) => {
      const on = isFav(btn.getAttribute('data-fav'));
      btn.classList.toggle('is-fav', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'Quitar de favoritos' : 'Agregar a favoritos';
    });
  }

  // Delegacion de eventos: cualquier click en [data-fav] alterna el favorito.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    btn.disabled = true;
    const now = await toggle(btn.getAttribute('data-fav'));
    btn.disabled = false;
    if (now === null) return; // redirigido a login
    btn.classList.toggle('is-fav', now);
    btn.setAttribute('aria-pressed', now ? 'true' : 'false');
    btn.title = now ? 'Quitar de favoritos' : 'Agregar a favoritos';
  });

  // Al cargar la pagina, sincronizar el estado de los corazones si hay sesion.
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('[data-fav]')) return;
    load().then(() => syncButtons());
  });

  window.Favorites = { load, isFav, add, remove, toggle, syncButtons };
})();

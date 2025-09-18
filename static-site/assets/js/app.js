// Basic SPA-like transitions and UI behaviors without heavy libraries
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Topbar close
  const topbar = $('#topbar');
  const topbarClose = $('#topbarClose');
  if (topbar && topbarClose) {
    topbarClose.addEventListener('click', ()=>{
      topbar.style.height = topbar.offsetHeight + 'px';
      requestAnimationFrame(()=>{
        topbar.style.transition = 'height .25s ease, opacity .25s ease';
        topbar.style.height = '0px';
        topbar.style.opacity = '0';
        setTimeout(()=> topbar.remove(), 280);
      });
    });
  }

  // Mobile menu
  const menuBtn = $('#menuBtn');
  const mobileMenu = $('#mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', ()=>{
      const hidden = mobileMenu.hasAttribute('hidden');
      hidden ? mobileMenu.removeAttribute('hidden') : mobileMenu.setAttribute('hidden','');
    });
  }

  // Search overlay
  const searchBtn = $('#searchBtn');
  const searchOverlay = $('#searchOverlay');
  const searchInput = $('#searchInput');
  const searchClose = $('#searchClose');
  if (searchBtn && searchOverlay) {
    searchBtn.addEventListener('click', ()=>{
      searchOverlay.removeAttribute('hidden');
      setTimeout(()=> searchInput && searchInput.focus(), 50);
    });
  }
  if (searchClose) {
    searchClose.addEventListener('click', ()=> searchOverlay.setAttribute('hidden',''));
  }
  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e)=>{
      if (e.target === searchOverlay) searchOverlay.setAttribute('hidden','');
    });
  }

  // Page transition overlay logic
  const overlay = $('#transitionOverlay');
  const links = $$('a[data-link]');
  function navigateWithTransition(href){
    if (!overlay) return window.location.assign(href);
    overlay.classList.add('active');
    setTimeout(()=>{ window.location.assign(href); }, 420);
  }
  links.forEach(a=>{
    a.addEventListener('click', (e)=>{
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.target === '_blank') return;
      e.preventDefault();
      navigateWithTransition(href);
    });
  });

  // Carrito eliminado: no se inicializa almacenamiento ni contador

  // Render products from embedded JSON (could be external file later)
  const products = [
    { id:'dbyo-sierra', name:'Sierra Nevada', price:42000, image:'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop', origin:'Sierra Nevada', process:'Lavado', roast:'Medio', notes:['Cacao','Nuez','Caramelo'] },
    { id:'dbyo-huila', name:'Huila', price:45000, image:'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop', origin:'Huila', process:'Honey', roast:'Claro', notes:['Panela','Frutos rojos','Floral'] },
    { id:'dbyo-narino', name:'Nariño', price:48000, image:'https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop', origin:'Nariño', process:'Natural', roast:'Oscuro', notes:['Cítricos','Chocolate','Miel'] }
  ];

  // Home grid
  const homeProducts = $('#homeProducts');
  if (homeProducts) {
    homeProducts.innerHTML = products.map(p => cardHTML(p)).join('');
  }

  // Catalog grid + filters
  const catalogGrid = $('#catalogGrid');
  if (catalogGrid) {
    const filterOrigin = $('#filterOrigin');
    const filterProcess = $('#filterProcess');
    const filterRoast = $('#filterRoast');

    // Populate selects
    const uniq = (arr) => Array.from(new Set(arr));
    const origins = uniq(products.map(p=>p.origin)).sort();
    const processes = uniq(products.map(p=>p.process)).sort();
    const roasts = uniq(products.map(p=>p.roast)).sort();
    if (filterOrigin) origins.forEach(v=> filterOrigin.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
    if (filterProcess) processes.forEach(v=> filterProcess.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
    if (filterRoast) roasts.forEach(v=> filterRoast.insertAdjacentHTML('beforeend', `<option>${v}</option>`));

    function applyFilters(){
      const fo = filterOrigin && filterOrigin.value || '';
      const fp = filterProcess && filterProcess.value || '';
      const fr = filterRoast && filterRoast.value || '';
      const list = products.filter(p => (
        (!fo || p.origin===fo) && (!fp || p.process===fp) && (!fr || p.roast===fr)
      ));
      renderCatalog(list);
    }
    function renderCatalog(list){
      catalogGrid.innerHTML = list.map(p=> cardHTML(p)).join('');
    }
    [filterOrigin, filterProcess, filterRoast].forEach(sel => sel && sel.addEventListener('change', applyFilters));
    renderCatalog(products);
  }

  // Carrito eliminado: no hay página de carrito ni checkout

  // Search logic (simple client-side filter)
  if (searchInput) {
    searchInput.addEventListener('input', ()=>{
      const q = searchInput.value.toLowerCase();
      const res = products.filter(p => (
        p.name.toLowerCase().includes(q) || p.origin.toLowerCase().includes(q) || p.notes.join(' ').toLowerCase().includes(q)
      ));
      const resultsEl = $('#searchResults');
      if (resultsEl) {
        resultsEl.innerHTML = res.map(p=> cardHTML(p)).join('');
      }
    });
  }

  // Helpers
  function cardHTML(p){
    return `
    <article class="card">
      <img src="${p.image}" alt="${escapeHtml(p.name)}">
      <div class="p">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="muted">${p.origin} · ${p.process} · ${p.roast}</div>
        <div class="price">$${p.price.toLocaleString('es-CO')}</div>
      </div>
    </article>`;
  }
  function escapeHtml(str){
    return str.replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }
})();

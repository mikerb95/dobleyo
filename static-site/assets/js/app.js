// Basic SPA-like transitions and UI behaviors without heavy libraries
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Topbar close
  const topbar = $('#topbar');
  const topbarClose = $('#topbarClose');
  // Floating header metrics depend on topbar height and header size
  const setHeaderMetrics = () => {
    const tb = $('#topbar');
    const top = tb ? (tb.offsetHeight + 12) : 12; // 12px breathing space
    const headerCont = document.querySelector('.site-header .container');
    const hh = headerCont ? headerCont.offsetHeight : 96;
    const pageOffset = top + hh + 28; // matches main.container padding-top
    const root = document.documentElement;
    root.style.setProperty('--header-top', top + 'px');
    root.style.setProperty('--header-height', hh + 'px');
    root.style.setProperty('--page-offset-top', pageOffset + 'px');
  };
  setHeaderMetrics();
  window.addEventListener('resize', setHeaderMetrics);
  if (topbar && topbarClose) {
    topbarClose.addEventListener('click', ()=>{
      topbar.style.height = topbar.offsetHeight + 'px';
      requestAnimationFrame(()=>{
        topbar.style.transition = 'height .25s ease, opacity .25s ease';
        topbar.style.height = '0px';
        topbar.style.opacity = '0';
        setTimeout(()=> { topbar.remove(); setHeaderMetrics(); }, 300);
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

  // Decorative beans inside header: scattered coffee beans with pointer repulsion
  (function initNavBeans(){
    const header = document.querySelector('.site-header .container');
    const layer = document.querySelector('.nav-beans');
    if (!header || !layer) return;
    const beanSrc = '../branding/coffebeannav.png';
  const beans = [];
  const COUNT = 44; // slightly more beans for visibility
    for (let i=0;i<COUNT;i++){
      const img = document.createElement('img');
      img.className = 'bean';
      img.src = beanSrc;
      // random position across the layer with small margins
      const xPct = 4 + Math.random()*92;
      const yPct = 8 + Math.random()*84;
      // random rotation and scale
      const rot = -40 + Math.random()*80; // -40..40 deg
      const scale = 0.8 + Math.random()*0.6; // 0.8..1.4
      // variable size for depth
  const size = 22 + Math.random()*20 + (Math.random() < 0.20 ? 12 : 0); // slightly smaller overall
      img.style.left = xPct + '%';
      img.style.top = yPct + '%';
      img.style.setProperty('--rot', rot+'deg');
      img.style.setProperty('--s', scale);
      img.style.setProperty('--bean-size', size+'px');
      // stash percent pos and a random factor to vary repulsion strength
      img._xPct = xPct / 100;
      img._yPct = yPct / 100;
      img._rand = Math.random();
      layer.appendChild(img);
      beans.push(img);
    }

    // Pointer-repel interaction over the header container
    const pointer = { x: 0, y: 0, active: false };
    let rafId = 0;
    function animate(){
      if (pointer.active){
        const rect = layer.getBoundingClientRect();
        const cx = pointer.x - rect.left;
        const cy = pointer.y - rect.top;
        for (const b of beans){
          const bx = (b._xPct || 0.5) * rect.width;
          const by = (b._yPct || 0.5) * rect.height;
          const dx0 = bx - cx;
          const dy0 = by - cy;
          const d = Math.hypot(dx0, dy0) || 0.0001;
          // influence radius and strength
          const radius = 140; // px
          const strength = 26 + (b._rand || 0)*22; // per-bean variation
          const falloff = Math.max(0, radius - d) / radius; // 0..1
          const repel = falloff * strength;
          const nx = dx0 / d;
          const ny = dy0 / d;
          const dx = nx * repel;
          const dy = ny * repel;
          b.style.setProperty('--dx', dx.toFixed(2)+'px');
          b.style.setProperty('--dy', dy.toFixed(2)+'px');
        }
      }
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    header.addEventListener('mouseenter', ()=>{
      pointer.active = true;
      header.classList.add('beans-active');
    });
    header.addEventListener('mousemove', (e)=>{
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });
    header.addEventListener('mouseleave', ()=>{
      pointer.active = false;
      header.classList.remove('beans-active');
      // reset offsets
      beans.forEach(b=>{
        b.style.setProperty('--dx','0px');
        b.style.setProperty('--dy','0px');
      });
    });
    // Clean up on page hide (not strictly necessary for this static site)
    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden && rafId){ cancelAnimationFrame(rafId); rafId = 0; }
      else if (!rafId){ rafId = requestAnimationFrame(animate); }
    });
  })();

  // Theme: light/dark
  (function initTheme(){
    const root = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const stored = localStorage.getItem('dbyo-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let theme = stored || (prefersDark ? 'dark' : 'light');
    apply(theme);
    const btn = $('#themeToggle');
    if (btn) {
      updateIcon(theme, btn);
      btn.addEventListener('click', ()=>{
        theme = (root.classList.contains('theme-dark') ? 'light' : 'dark');
        apply(theme);
        updateIcon(theme, btn);
        localStorage.setItem('dbyo-theme', theme);
      });
    }
    function apply(t){
      if (t === 'dark') root.classList.add('theme-dark'); else root.classList.remove('theme-dark');
      if (metaTheme) metaTheme.setAttribute('content', t==='dark' ? '#0f0f0f' : '#251a14');
    }
    function updateIcon(t, el){ el.textContent = (t==='dark' ? '☀️' : '🌙'); }
  })();

  // Búsqueda eliminada: se retira overlay y eventos

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
  const productsDefault = [
    { id:'dbyo-sierra', name:'Sierra Nevada', price:42000, image:'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop', origin:'Sierra Nevada', process:'Lavado', roast:'Medio', notes:['Cacao','Nuez','Caramelo'] },
    { id:'dbyo-huila', name:'Huila', price:45000, image:'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop', origin:'Huila', process:'Honey', roast:'Claro', notes:['Panela','Frutos rojos','Floral'] },
    { id:'dbyo-narino', name:'Nariño', price:48000, image:'https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop', origin:'Nariño', process:'Natural', roast:'Oscuro', notes:['Cítricos','Chocolate','Miel'] }
  ];
  const products = (function(){ try{ const x = JSON.parse(localStorage.getItem('dbyo-products')||'null'); return Array.isArray(x)?x:productsDefault; }catch{ return productsDefault; } })();

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

  // Lógica de búsqueda eliminada

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

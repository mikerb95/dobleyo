// Basic SPA-like transitions and UI behaviors without heavy libraries
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Topbar close
  const topbar = $('#topbar');
  const topbarClose = $('#topbarClose');
  // Floating header offset depends on topbar height
  const setHeaderTop = () => {
    const tb = $('#topbar');
    const top = tb ? (tb.offsetHeight + 12) : 12;
    document.documentElement.style.setProperty('--header-top', top + 'px');
  };
  setHeaderTop();
  window.addEventListener('resize', setHeaderTop);
  if (topbar && topbarClose) {
    topbarClose.addEventListener('click', ()=>{
      topbar.style.height = topbar.offsetHeight + 'px';
      requestAnimationFrame(()=>{
        topbar.style.transition = 'height .25s ease, opacity .25s ease';
        topbar.style.height = '0px';
        topbar.style.opacity = '0';
        setTimeout(()=> { topbar.remove(); setHeaderTop(); }, 300);
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

  // Decorative beans inside header: subtle movement on nav hover
  (function initNavBeans(){
    const header = document.querySelector('.site-header .container');
    const layer = document.querySelector('.nav-beans');
    const nav = document.querySelector('.site-header .nav');
    if (!header || !layer || !nav) return;
    const beanSrc = 'assets/beans.svg';
    const beans = [];
    const COUNT = 6;
    for (let i=0;i<COUNT;i++){
      const img = document.createElement('img');
      img.className = 'bean';
      img.src = beanSrc;
      const x = 6 + Math.random()*88; // percentage
      const y = 10 + Math.random()*70;
      const r = -15 + Math.random()*30;
      const s = 0.7 + Math.random()*0.5;
      img.style.left = x + '%';
      img.style.top = y + '%';
      img.style.setProperty('--rot', r+'deg');
      img.style.setProperty('--s', s);
      layer.appendChild(img);
      beans.push(img);
    }
    // Hover interaction: move slightly depending on hovered index
    const items = Array.from(nav.querySelectorAll('a'));
    items.forEach((a, idx)=>{
      a.addEventListener('mouseenter', ()=>{
        header.classList.add('beans-active');
        const fx = (idx - items.length/2) * 0.12; // direction factor
        beans.forEach((b, i)=>{
          const dx = (Math.sin((idx+i)*1.7)+Math.cos(i*2.3))*6; // px
          const dy = (Math.cos((idx+i)*1.3))*4;
          b.style.setProperty('--dx', (dx* (1+i*0.07)).toFixed(2)+'px');
          b.style.setProperty('--dy', (dy* (1+i*0.05)).toFixed(2)+'px');
          b.style.setProperty('--fx', (1+fx).toFixed(2));
          b.style.setProperty('--fy', '1');
        });
      });
      a.addEventListener('mouseleave', ()=>{
        header.classList.remove('beans-active');
        beans.forEach((b)=>{
          b.style.setProperty('--dx','0px');
          b.style.setProperty('--dy','0px');
          b.style.setProperty('--fx','1');
          b.style.setProperty('--fy','1');
        });
      });
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

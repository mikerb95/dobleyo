// Admin panel (static env): pseudo-auth + CRUD storing data in localStorage
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const loginView = $('#loginView');
  const adminView = $('#adminView');
  const loginBtn = $('#admLoginBtn');
  const logoutBtn = $('#admLogoutBtn');

  const lotsTable = $('#lotsTable tbody');
  const prodTable = $('#prodTable tbody');
  const blogTable = $('#blogTable tbody');

  // demo credentials (static): admin@dobleyo.local / dobleyo-admin
  const KEY_AUTH = 'dbyo-admin-token';
  const KEY_LOTS = 'dbyo-lots';
  const KEY_PROD = 'dbyo-products';
  const KEY_BLOG = 'dbyo-blog';

  function isAuth(){ return !!localStorage.getItem(KEY_AUTH); }
  function login(){ localStorage.setItem(KEY_AUTH, '1'); render(); }
  function logout(){ localStorage.removeItem(KEY_AUTH); render(); }

  function load(key, fallback){ try{ const x = JSON.parse(localStorage.getItem(key)||'null'); return Array.isArray(x)?x:fallback; }catch{ return fallback; } }
  function save(key, data){ localStorage.setItem(key, JSON.stringify(data)); }

  // Seed defaults from current site data
  const seedProducts = [
    { id:'dbyo-sierra', name:'Sierra Nevada', price:42000, origin:'Sierra Nevada', process:'Lavado', roast:'Medio', image:'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=800&auto=format&fit=crop' },
    { id:'dbyo-huila', name:'Huila', price:45000, origin:'Huila', process:'Honey', roast:'Claro', image:'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=800&auto=format&fit=crop' },
    { id:'dbyo-narino', name:'Nariño', price:48000, origin:'Nariño', process:'Natural', roast:'Oscuro', image:'https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=800&auto=format&fit=crop' }
  ];
  const seedLots = [];
  const seedBlog = [];

  function render(){
    const authed = isAuth();
    if (!loginView || !adminView) return;
    loginView.style.display = authed ? 'none' : '';
    adminView.style.display = authed ? '' : 'none';
    if (!authed) return;

    // tabs
    const tabs = $$('[data-tab]');
    tabs.forEach(a=>{
      a.onclick = (e)=>{
        e.preventDefault();
        tabs.forEach(t=> t.classList.remove('active'));
        a.classList.add('active');
        const id = a.getAttribute('href').replace('#','');
        $('#tab-lotes').style.display = id==='lotes'? '' : 'none';
        $('#tab-productos').style.display = id==='productos'? '' : 'none';
        $('#tab-blog').style.display = id==='blog'? '' : 'none';
      };
    });

    // data
    const lots = load(KEY_LOTS, seedLots);
    const prods = load(KEY_PROD, seedProducts);
    const posts = load(KEY_BLOG, seedBlog);

    // render lots
    lotsTable.innerHTML = lots.map((l, i)=>`<tr>
      <td>${esc(l.lot)}</td><td>${esc(l.name||'')}</td><td>${esc(l.origin||'')}</td><td>${esc(l.process||'')}</td><td>${esc(l.variety||'')}</td>
      <td>
        <button class="btn-sec" data-edit-lot="${i}">Editar</button>
        <button class="btn-danger" data-del-lot="${i}">Eliminar</button>
      </td>
    </tr>`).join('');

    // render products
    prodTable.innerHTML = prods.map((p, i)=>`<tr>
      <td>${esc(p.name)}</td><td>$${Number(p.price).toLocaleString('es-CO')}</td><td>${esc(p.origin||'')}</td><td>${esc(p.process||'')}</td><td>${esc(p.roast||'')}</td>
      <td>
        <button class="btn-sec" data-edit-prod="${i}">Editar</button>
        <button class="btn-danger" data-del-prod="${i}">Eliminar</button>
      </td>
    </tr>`).join('');

    // render blog
    blogTable.innerHTML = posts.map((p, i)=>`<tr>
      <td>${esc(p.title||'')}</td><td>${esc(p.author||'')}</td><td>${p.published? 'Sí':'No'}</td>
      <td>
        <button class="btn-sec" data-edit-post="${i}">Editar</button>
        <button class="btn-danger" data-del-post="${i}">Eliminar</button>
      </td>
    </tr>`).join('');

    // actions
    $('#lotsAdd').onclick = ()=> editLot();
    $('#prodAdd').onclick = ()=> editProd();
    $('#blogAdd').onclick = ()=> editPost();
    $('#lotsExport').onclick = ()=> download('lotes.json', JSON.stringify(load(KEY_LOTS, seedLots), null, 2));
    $('#prodExport').onclick = ()=> download('productos.json', JSON.stringify(load(KEY_PROD, seedProducts), null, 2));
    $('#blogExport').onclick = ()=> download('blog.json', JSON.stringify(load(KEY_BLOG, seedBlog), null, 2));

    $$("[data-edit-lot]").forEach(btn=> btn.onclick = ()=> editLot(Number(btn.dataset.editLot)));
    $$("[data-del-lot]").forEach(btn=> btn.onclick = ()=> delRow(KEY_LOTS, Number(btn.dataset.delLot)));

    $$("[data-edit-prod]").forEach(btn=> btn.onclick = ()=> editProd(Number(btn.dataset.editProd)));
    $$("[data-del-prod]").forEach(btn=> btn.onclick = ()=> delRow(KEY_PROD, Number(btn.dataset.delProd)));

    $$("[data-edit-post]").forEach(btn=> btn.onclick = ()=> editPost(Number(btn.dataset.editPost)));
    $$("[data-del-post]").forEach(btn=> btn.onclick = ()=> delRow(KEY_BLOG, Number(btn.dataset.delPost)));
  }

  function esc(s){ return (s||'').toString().replace(/[&<>"]/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
  function download(name, data){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type:'application/json'})); a.download = name; a.click(); URL.revokeObjectURL(a.href); }

  function delRow(key, idx){ const arr = load(key, []); arr.splice(idx,1); save(key, arr); render(); }

  function promptJSON(obj, title){
    const s = prompt((title||'Editar JSON')+"\n(Formato JSON)\n", JSON.stringify(obj, null, 2));
    if (!s) return null;
    try{ return JSON.parse(s); }catch{ alert('JSON inválido'); return null; }
  }

  function editLot(idx){
    const arr = load(KEY_LOTS, seedLots);
    const base = arr[idx] || { lot:'DBY-2025-09-XXX', name:'', origin:'', farm:'', producer:'', altitude:'', process:'', variety:'', harvestDate:'', roastDate:'', moisture:'', score:'', notes:[] };
    const v = promptJSON(base, idx!=null?'Editar lote':'Nuevo lote');
    if (!v) return;
    if (idx!=null) arr[idx]=v; else arr.push(v);
    save(KEY_LOTS, arr); render();
  }

  function editProd(idx){
    const arr = load(KEY_PROD, seedProducts);
    const base = arr[idx] || { id: 'id-'+Date.now(), name:'', price:0, origin:'', process:'', roast:'', image:'' };
    const v = promptJSON(base, idx!=null?'Editar producto':'Nuevo producto');
    if (!v) return;
    if (idx!=null) arr[idx]=v; else arr.push(v);
    save(KEY_PROD, arr); render();
  }

  function editPost(idx){
    const arr = load(KEY_BLOG, seedBlog);
    const base = arr[idx] || { id: 'post-'+Date.now(), title:'', author:'', content:'', published:false, cover:'' };
    const v = promptJSON(base, idx!=null?'Editar post':'Nuevo post');
    if (!v) return;
    if (idx!=null) arr[idx]=v; else arr.push(v);
    save(KEY_BLOG, arr); render();
  }

  // Login wiring
  if (loginBtn) loginBtn.onclick = login;
  if (logoutBtn) logoutBtn.onclick = logout;
  render();
})();

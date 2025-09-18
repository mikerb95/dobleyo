// Blog page: read posts from localStorage (admin) or fallback to static samples
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  const sample = [
    { id:'post-1', title:'Receta V60 básica', author:'Equipo DobleYo', cover:'https://images.unsplash.com/photo-1498804103079-a6351b050096?q=80&w=1200&auto=format&fit=crop', minutes:3 },
    { id:'post-2', title:'Notas de cata: Huila', author:'Equipo DobleYo', cover:'https://images.unsplash.com/photo-1517705008128-361805f42e86?q=80&w=1200&auto=format&fit=crop', minutes:4 },
    { id:'post-3', title:'Guía de molienda por método', author:'Equipo DobleYo', cover:'https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=1200&auto=format&fit=crop', minutes:5 }
  ];
  let posts = sample;
  try{
    const x = JSON.parse(localStorage.getItem('dbyo-blog')||'null');
    if (Array.isArray(x) && x.length) posts = x.filter(p=>p.published!==false);
  }catch{}

  grid.innerHTML = posts.map(p => `
    <article class="card">
      <img src="${esc(p.cover||sample[0].cover)}" alt="${esc(p.title)}">
      <div class="p">
        <h3>${esc(p.title)}</h3>
        <div class="muted">${esc(p.author||'DobleYo')}${p.minutes? ' · '+p.minutes+' min':''}</div>
      </div>
    </article>
  `).join('');

  function esc(s){ return (s||'').toString().replace(/[&<>"]/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
})();

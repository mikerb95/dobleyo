// Pagina de blog: leer posts desde localStorage (admin) o usar muestras estaticas si no hay
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  const sample = [
  { id:'post-1', title:'Receta V60 básica', author:'Equipo DobleYo', cover:'assets/img/products/molinillo.svg', minutes:3 },
  { id:'post-2', title:'Notas de cata: Huila', author:'Equipo DobleYo', cover:'assets/img/products/huila.svg', minutes:4 },
  { id:'post-3', title:'Guía de molienda por método', author:'Equipo DobleYo', cover:'assets/img/products/sierra.svg', minutes:5 }
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

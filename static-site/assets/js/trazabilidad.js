// Trazabilidad por QR o código manual
(function(){
  const $ = (s, r=document) => r.querySelector(s);

  // Dataset de ejemplo (en producción esto sería un JSON estático o API)
  const lots = [
    {
      lot: 'DBY-2025-09-HUI',
      name: 'Huila - Lote Sept 2025',
      origin: 'Huila, Colombia',
      farm: 'Finca El Bosque',
      producer: 'Familia Rodríguez',
      altitude: '1800 msnm',
      process: 'Honey',
      variety: 'Caturra',
      harvestDate: '2025-07-10',
      roastDate: '2025-09-05',
      moisture: '10.5%',
      score: 86.5,
      notes: ['Panela','Frutos rojos','Floral']
    },
    {
      lot: 'DBY-2025-08-NAR',
      name: 'Nariño - Lote Ago 2025',
      origin: 'Nariño, Colombia',
      farm: 'La Primavera',
      producer: 'Ana Gómez',
      altitude: '2000 msnm',
      process: 'Natural',
      variety: 'Castillo',
      harvestDate: '2025-06-05',
      roastDate: '2025-08-28',
      moisture: '10.8%',
      score: 87.2,
      notes: ['Cítricos','Chocolate','Miel']
    }
  ];

  // UI elements
  const video = $('#qrVideo');
  const startBtn = $('#startScan');
  const stopBtn = $('#stopScan');
  const lotInput = $('#lotInput');
  const lookupBtn = $('#lookupBtn');

  const resWrap = $('#result');
  const resEmpty = $('#resultEmpty');
  const resName = $('#resName');
  const resLot = $('#resLot');
  const resChips = $('#resChips');
  const resDetails = $('#resDetails');

  function renderResult(item){
    if (!item){
      resWrap.style.display = 'none';
      resEmpty.style.display = '';
      return;
    }
    resEmpty.style.display = 'none';
    resWrap.style.display = '';
    resName.textContent = item.name;
    resLot.textContent = item.lot + ' · ' + item.origin;
    resChips.innerHTML = '';
    [item.process, item.variety, item.altitude].filter(Boolean).forEach(ch => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = ch;
      resChips.appendChild(span);
    });
    resDetails.innerHTML = '';
    const fields = [
      ['Productor', item.producer],
      ['Finca', item.farm],
      ['Fecha de cosecha', item.harvestDate],
      ['Fecha de tueste', item.roastDate],
      ['Humedad', item.moisture],
      ['Puntaje', item.score],
      ['Notas', item.notes && item.notes.join(', ')]
    ];
    fields.forEach(([k,v])=>{
      if (!v) return;
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      resDetails.appendChild(dt); resDetails.appendChild(dd);
    });
  }

  function findByLot(code){
    const c = (code||'').trim().toUpperCase();
    return lots.find(l => l.lot.toUpperCase()===c) || null;
  }

  // Manual lookup
  if (lookupBtn){
    lookupBtn.addEventListener('click', ()=>{
      renderResult(findByLot(lotInput.value));
    });
  }

  // QR scanning via MediaDevices + library-less fallback (decode by server ideally)
  // Aquí sólo obtenemos video; no decodificamos QR por JS puro para mantenerlo simple.
  // Instrucción UX: simularemos lectura si el usuario pega un texto con un patrón de lote en el input.
  let stream;
  async function startScan(){
    try{
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
      if (video){ video.srcObject = stream; await video.play(); }
    }catch(err){
      console.warn('No se pudo abrir la cámara', err);
      alert('No se pudo acceder a la cámara. Usa la búsqueda manual por código.');
    }
  }
  function stopScan(){
    if (stream){ stream.getTracks().forEach(t=> t.stop()); stream = null; }
    if (video){ video.pause(); video.srcObject = null; }
  }
  if (startBtn) startBtn.addEventListener('click', startScan);
  if (stopBtn) stopBtn.addEventListener('click', stopScan);

  // Sugerencia: si el usuario pega un valor tipo lote en el input, resolvemos.
  if (lotInput){
    lotInput.addEventListener('paste', (e)=>{
      setTimeout(()=> renderResult(findByLot(lotInput.value)), 0);
    });
    lotInput.addEventListener('keydown', (e)=>{
      if (e.key==='Enter') { e.preventDefault(); renderResult(findByLot(lotInput.value)); }
    });
  }

})();

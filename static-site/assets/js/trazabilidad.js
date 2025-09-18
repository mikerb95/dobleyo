// Trazabilidad por QR o código manual
(function(){
  const $ = (s, r=document) => r.querySelector(s);

  // Dataset: se carga desde assets/data/lotes.json; fallback a inline si falla
  let lots = [
    {
      lot: 'DBY-2025-09-HUI', name: 'Huila - Lote Sept 2025', origin: 'Huila, Colombia', farm: 'Finca El Bosque', producer: 'Familia Rodríguez', altitude: '1800 msnm', process: 'Honey', variety: 'Caturra', harvestDate: '2025-07-10', roastDate: '2025-09-05', moisture: '10.5%', score: 86.5, notes: ['Panela','Frutos rojos','Floral']
    },
    {
      lot: 'DBY-2025-08-NAR', name: 'Nariño - Lote Ago 2025', origin: 'Nariño, Colombia', farm: 'La Primavera', producer: 'Ana Gómez', altitude: '2000 msnm', process: 'Natural', variety: 'Castillo', harvestDate: '2025-06-05', roastDate: '2025-08-28', moisture: '10.8%', score: 87.2, notes: ['Cítricos','Chocolate','Miel']
    }
  ];
  async function loadLots(){
    try{
      const res = await fetch('assets/data/lotes.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      if (Array.isArray(data)) lots = data;
    }catch(e){
      console.warn('No se pudo cargar lotes.json, usando fallback inline', e);
    }
  }

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

  // QR scanning via MediaDevices + jsQR
  let stream, rafId, canvas, ctx;
  const overlay = document.getElementById('qrOverlay');
  const octx = overlay ? overlay.getContext('2d') : null;
  const scanStatus = document.getElementById('scanStatus');
  function setStatus(t){ if (scanStatus) scanStatus.textContent = t; }
  async function startScan(){
    try{
      setStatus('Abriendo cámara...');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
      if (video){
        video.srcObject = stream;
        await video.play();
        if (!canvas){ canvas = document.createElement('canvas'); ctx = canvas.getContext('2d'); }
        tick();
        setStatus('Escaneando... Apunta al QR.');
      }
    }catch(err){
      console.warn('No se pudo abrir la cámara', err);
      alert('No se pudo acceder a la cámara. Usa la búsqueda manual por código.');
      setStatus('Permiso denegado o no disponible.');
    }
  }
  function stopScan(){
    if (rafId) cancelAnimationFrame(rafId);
    if (stream){ stream.getTracks().forEach(t=> t.stop()); stream = null; }
    if (video){ video.pause(); video.srcObject = null; }
    setStatus('Escaneo detenido.');
  }
  function tick(){
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA){ rafId = requestAnimationFrame(tick); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    if (overlay){ overlay.width = video.clientWidth; overlay.height = video.clientHeight; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try{
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' }) : null;
      if (code && code.data){
        // Dibuja bounding box
        if (octx && overlay){
          octx.clearRect(0,0,overlay.width, overlay.height);
          drawLine(code.location.topLeftCorner, code.location.topRightCorner, '#00ff7f');
          drawLine(code.location.topRightCorner, code.location.bottomRightCorner, '#00ff7f');
          drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, '#00ff7f');
          drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, '#00ff7f');
        }
        // Normalizamos: si el QR contiene URL con ?lote=..., extraemos; si no, usamos el texto como código.
        let val = (code.data || '').trim();
        const m = val.match(/[?&]lote=([^&#\s]+)/i);
        if (m) val = decodeURIComponent(m[1]);
        stopScan();
        renderResult(findByLot(val));
        setStatus('QR leído.');
        return;
      }
      // Si no hay QR válido, limpia overlay
      if (octx && overlay){ octx.clearRect(0,0,overlay.width, overlay.height); }
      setStatus('Escaneando...');
    }catch(e){
      // Si getImageData falla por CORS u otro, ignoramos
    }
    rafId = requestAnimationFrame(tick);
  }

  function drawLine(begin, end, color){
    if (!octx || !overlay) return;
    // Convertimos coords del frame de video (canvas interno) a coords del overlay escalado al tamaño visible del video.
    const scaleX = overlay.width / canvas.width;
    const scaleY = overlay.height / canvas.height;
    octx.strokeStyle = color; octx.lineWidth = 3; octx.beginPath();
    octx.moveTo(begin.x * scaleX, begin.y * scaleY);
    octx.lineTo(end.x * scaleX, end.y * scaleY);
    octx.stroke();
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

  // Deep-link: ?lote=...
  function preloadFromQuery(){
    const params = new URLSearchParams(location.search);
    const q = params.get('lote');
    if (q){
      // Rendir tras asegurar que los lotes estén cargados
      renderResult(findByLot(q));
      const input = document.getElementById('lotInput');
      if (input) input.value = q;
    }
  }

  // Init: cargar lotes y luego intentar pre-cargar por query
  (async()=>{
    await loadLots();
    preloadFromQuery();
  })();

})();

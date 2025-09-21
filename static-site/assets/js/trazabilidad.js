// Trazabilidad por QR o codigo manual
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
  // 1) lotes provistos por admin desde localStorage
    try{
      const ls = JSON.parse(localStorage.getItem('dbyo-lots')||'null');
      if (Array.isArray(ls) && ls.length){ lots = ls; return; }
    }catch{}
  // 2) JSON externo
    try{
      const res = await fetch('assets/data/lotes.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      if (Array.isArray(data)) lots = data;
    }catch(e){
      console.warn('No se pudo cargar lotes.json, usando fallback inline', e);
    }
  }

  // Elementos de UI
  const video = $('#qrVideo');
  const startBtn = $('#startScan');
  const stopBtn = $('#stopScan');
  const restartBtn = document.getElementById('restartScan');
  const lotInput = $('#lotInput');
  const lookupBtn = $('#lookupBtn');
  const lotError = document.getElementById('lotError');
  const toast = document.getElementById('toast');

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

  // Validacion de formato de lote: DBY-YYYY-MM-XXX (letras mayusculas en sufijo)
  function validateLotFormat(code){
  const re = /^DBY-20\d{2}-\d{2}-[A-Z]{3}$/; // simple: ano 20xx, mes 2 digitos, sufijo 3 letras
    return re.test((code||'').trim().toUpperCase());
  }

  function showLotError(msg){ if (lotError){ lotError.textContent = msg; lotError.style.display = msg ? '' : 'none'; } }
  function showToast(msg, ms=2600){
    if (!toast) return;
    toast.textContent = msg;
    toast.removeAttribute('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.setAttribute('hidden',''), ms);
  }

  // Consulta manual
  if (lookupBtn){
    lookupBtn.addEventListener('click', ()=>{
      const val = lotInput.value;
      if (!validateLotFormat(val)){
        showLotError('Formato inválido. Usa: DBY-YYYY-MM-XXX (p.ej. DBY-2025-09-HUI).');
        return;
      }
      showLotError('');
      renderResult(findByLot(val));
    });
  }

  // Escaneo QR via MediaDevices + jsQR
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
      showToast('No se pudo acceder a la cámara. Usa el código manual.');
      setStatus('Permiso denegado o no disponible.');
    }
  }
  function stopScan(){
    if (rafId) cancelAnimationFrame(rafId);
    if (stream){ stream.getTracks().forEach(t=> t.stop()); stream = null; }
    if (video){ video.pause(); video.srcObject = null; }
    setStatus('Escaneo detenido.');
    if (restartBtn) restartBtn.removeAttribute('hidden');
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
  // Dibuja caja delimitadora
        if (octx && overlay){
          octx.clearRect(0,0,overlay.width, overlay.height);
          // Caja delimitadora
          drawLine(code.location.topLeftCorner, code.location.topRightCorner, '#00ff7f');
          drawLine(code.location.topRightCorner, code.location.bottomRightCorner, '#00ff7f');
          drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, '#00ff7f');
          drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, '#00ff7f');
          // Marcas de esquina en forma de L
          drawCorner(code.location.topLeftCorner, 'tl', '#00ff7f');
          drawCorner(code.location.topRightCorner, 'tr', '#00ff7f');
          drawCorner(code.location.bottomRightCorner, 'br', '#00ff7f');
          drawCorner(code.location.bottomLeftCorner, 'bl', '#00ff7f');
        }
  // Normalizamos: si el QR contiene URL con ?lote=..., extraemos; si no, usamos el texto como codigo.
        let val = (code.data || '').trim();
        const m = val.match(/[?&]lote=([^&#\s]+)/i);
        if (m) val = decodeURIComponent(m[1]);
        stopScan();
        renderResult(findByLot(val));
        setStatus('QR leído.');
        return;
      }
  // Si no hay QR valido, limpia overlay
      if (octx && overlay){ octx.clearRect(0,0,overlay.width, overlay.height); }
      setStatus('Escaneando...');
    }catch(e){
  // Si getImageData falla por CORS u otro, ignoramos
    }
    rafId = requestAnimationFrame(tick);
  }

  function drawLine(begin, end, color){
    if (!octx || !overlay) return;
  // Convertimos coords del frame de video (canvas interno) a coords del overlay escalado al tamano visible del video.
    const scaleX = overlay.width / canvas.width;
    const scaleY = overlay.height / canvas.height;
    octx.strokeStyle = color; octx.lineWidth = 3; octx.beginPath();
    octx.moveTo(begin.x * scaleX, begin.y * scaleY);
    octx.lineTo(end.x * scaleX, end.y * scaleY);
    octx.stroke();
  }
  function drawCorner(pt, pos, color){
    if (!octx || !overlay) return;
    const scaleX = overlay.width / canvas.width;
    const scaleY = overlay.height / canvas.height;
    const x = pt.x * scaleX; const y = pt.y * scaleY;
    const len = 18; const w = 4;
    octx.strokeStyle = color; octx.lineWidth = w;
    octx.beginPath();
    if (pos==='tl' || pos==='bl') { octx.moveTo(x, y); octx.lineTo(x+len, y); } else { octx.moveTo(x, y); octx.lineTo(x-len, y); }
    octx.stroke();
    octx.beginPath();
    if (pos==='tl' || pos==='tr') { octx.moveTo(x, y); octx.lineTo(x, y+len); } else { octx.moveTo(x, y); octx.lineTo(x, y-len); }
    octx.stroke();
  }
  if (startBtn) startBtn.addEventListener('click', startScan);
  if (stopBtn) stopBtn.addEventListener('click', stopScan);
  if (restartBtn) restartBtn.addEventListener('click', ()=>{ restartBtn.setAttribute('hidden',''); startScan(); });

  // Sugerencia: si el usuario pega un valor tipo lote en el input, resolvemos.
  if (lotInput){
    lotInput.addEventListener('paste', (e)=>{
      setTimeout(()=>{
        const val = lotInput.value;
        if (!validateLotFormat(val)){
          showLotError('Formato inválido. Usa: DBY-YYYY-MM-XXX.');
          return;
        }
        showLotError('');
        renderResult(findByLot(val));
      }, 0);
    });
    lotInput.addEventListener('keydown', (e)=>{
      if (e.key==='Enter') {
        e.preventDefault();
        const val = lotInput.value;
        if (!validateLotFormat(val)){
          showLotError('Formato inválido. Usa: DBY-YYYY-MM-XXX.');
          return;
        }
        showLotError('');
        renderResult(findByLot(val));
      }
    });
  }

  // Deep link: ?lote=...
  function preloadFromQuery(){
    const params = new URLSearchParams(location.search);
    const q = params.get('lote');
    if (q){
  // Renderizar tras asegurar que los lotes esten cargados
      renderResult(findByLot(q));
      const input = document.getElementById('lotInput');
      if (input) input.value = q;
    }
  }

  // Init: cargar lotes y luego intentar precargar por query
  (async()=>{
    await loadLots();
    preloadFromQuery();
  })();

})();

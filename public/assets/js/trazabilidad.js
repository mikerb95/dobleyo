// Trazabilidad por QR o código manual — conectado a la BD
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  // ─── API ─────────────────────────────────────────────────────────
  async function lookupCode(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) return null;
    const res = await fetch(`/api/traceability/${encodeURIComponent(trimmed)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Error de red: ' + res.status);
    const json = await res.json();
    return json.success ? json.data : null;
  // ─── UI Elements ────────────────────────────────────────────────
  const video      = $('#qrVideo');
  const startBtn   = $('#startScan');
  const stopBtn    = $('#stopScan');
  const restartBtn = document.getElementById('restartScan');
  const lotInput   = $('#lotInput');
  const lookupBtn  = $('#lookupBtn');
  const lotError   = document.getElementById('lotError');
  const toast      = document.getElementById('toast');
  const resWrap    = $('#result');
  const resEmpty   = $('#resultEmpty');
  const resName    = $('#resName');
  const resLot     = $('#resLot');
  const resChips   = $('#resChips');
  const resDetails = $('#resDetails');

  // ─── Render ───────────────────────────────────────────────────────

  function renderResult(data) {
    if (!data || !data.harvest) {
      if (resWrap)  resWrap.style.display  = 'none';
      if (resEmpty) resEmpty.style.display = '';
      return;
    }
    if (resEmpty) resEmpty.style.display = 'none';
    if (resWrap)  resWrap.style.display  = '';
    const h = data.harvest;
    if (resName) resName.textContent = buildLotName(h);
    if (resLot)  resLot.textContent  = (data.lot_code||data.code) + ' · ' + regionLabel(h.region);
    if (resChips) {
      resChips.innerHTML = '';
      [h.process, h.variety, h.altitude ? h.altitude + ' msnm' : null].filter(Boolean).forEach(text => {
        const span = document.createElement('span');
        span.className = 'trace-chip'; span.textContent = text;
        resChips.appendChild(span);
      });
    }
    if (resDetails) {
      resDetails.innerHTML = '';
      appendDetail(resDetails, 'Finca',       h.farm);
      appendDetail(resDetails, 'Región',      regionLabel(h.region));
      appendDetail(resDetails, 'Altitud',     h.altitude ? h.altitude + ' msnm' : null);
      appendDetail(resDetails, 'Variedad',    h.variety);
      appendDetail(resDetails, 'Proceso',     h.process);
      appendDetail(resDetails, 'Clima',       h.climate);
      appendDetail(resDetails, 'Aroma',       h.aroma);
      appendDetail(resDetails, 'Sabor',       h.taste_notes);
      appendDetail(resDetails, 'Cosecha',     fmtDate(h.date));
      if (data.storage) {
        appendDetail(resDetails, 'Almacén',      data.storage.location);
        appendDetail(resDetails, 'Fecha almacén', fmtDate(data.storage.date));
      }
      if (data.roasted) {
        appendDetail(resDetails, 'Tueste',      data.roasted.roast_level);
        if (data.roasted.actual_temp)        appendDetail(resDetails, 'Temperatura', data.roasted.actual_temp + ' °C');
        if (data.roasted.roast_time_minutes) appendDetail(resDetails, 'Tiempo tueste', data.roasted.roast_time_minutes + ' min');
        appendDetail(resDetails, 'Fecha tueste', fmtDate(data.roasted.date));
      }
      if (data.packaged && data.packaged.score) {
        appendDetail(resDetails, 'Puntaje SCA', data.packaged.score);
        appendDetail(resDetails, 'Acidez',  scoreLabel(data.packaged.acidity));
        appendDetail(resDetails, 'Cuerpo',  scoreLabel(data.packaged.body));
        appendDetail(resDetails, 'Balance', scoreLabel(data.packaged.balance));
        appendDetail(resDetails, 'Empaque', data.packaged.package_size);
      }
      if (data.label && data.label.flavor_notes) appendDetail(resDetails, 'Notas', data.label.flavor_notes);
    }
  }

  function appendDetail(p, label, val) {
    if (!val && val !== 0) return;
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = val;
    p.appendChild(dt); p.appendChild(dd);
  }
  function buildLotName(h) {
    return [regionLabel(h.region), h.variety, h.date && new Date(h.date).getFullYear()].filter(Boolean).join(' — ');
  }
  function regionLabel(code) {
    const m = {HUI:'Huila',NAR:'Nariño',CAU:'Cauca',ANT:'Antioquia',CUN:'Cundinamarca',
               TOL:'Tolima',BOY:'Boyacá',MAG:'Magdalena',SAN:'Santander',
               RIS:'Risaralda',CAL:'Caldas',QUI:'Quindío'};
    return m[(code||'').toUpperCase()] || code || 'Colombia';
  }
  function scoreLabel(n) {
    const m = {1:'Bajo',2:'Medio-bajo',3:'Medio',4:'Alto',5:'Excepcional'};
    return n != null ? (m[n] || n) + ` (${n}/5)` : null;
  }
  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('es-CO', {year:'numeric',month:'long',day:'numeric'}) : null;
  }

  // ─── Errores y estado ─────────────────────────────────────────────

  function showLotError(msg) { if (lotError) { lotError.textContent = msg; lotError.style.display = msg ? '' : 'none'; } }
  function showToast(msg, ms=2600) {
    if (!toast) return;
    toast.textContent = msg; toast.removeAttribute('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.setAttribute('hidden',''), ms);
  }
  function setStatus(t) { const el = document.getElementById('scanStatus'); if (el) el.textContent = t; }

  // ─── Lookup manual ───────────────────────────────────────────────

  async function handleLookup(val) {
    const code = (val || lotInput?.value || '').trim();
    if (!code) { showLotError('Ingresa un código de lote.'); return; }
    showLotError(''); setStatus('Consultando base de datos...');
    try {
      const data = await lookupCode(code);
      if (!data) { showLotError('No se encontró ningún lote con ese código.'); renderResult(null); }
      else        { renderResult(data); }
    } catch { showLotError('Error de red. Verifica tu conexión.'); }
    finally   { setStatus(''); }
  }

  if (lookupBtn) lookupBtn.addEventListener('click', () => handleLookup());
  if (lotInput) {
    lotInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); }});
    lotInput.addEventListener('paste', () => setTimeout(() => handleLookup(lotInput.value), 0));
  }

  // ─── Escáner QR ──────────────────────────────────────────────────

  let stream, rafId, canvas, ctx;
  const overlay = document.getElementById('qrOverlay');
  const octx    = overlay ? overlay.getContext('2d') : null;

  async function startScan() {
    try {
      setStatus('Abriendo cámara...');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (video) {
        video.srcObject = stream; await video.play();
        if (!canvas) { canvas = document.createElement('canvas'); ctx = canvas.getContext('2d'); }
        tick(); setStatus('Escaneando... Apunta al QR.');
      }
    } catch(err) {
      console.warn('No se pudo abrir la cámara', err);
      showToast('No se pudo acceder a la cámara. Usa el código manual.');
      setStatus('Permiso denegado o cámara no disponible.');
    }
  }
  function stopScan() {
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video)  { video.pause(); video.srcObject = null; }
    setStatus('Escaneo detenido.');
    if (restartBtn) restartBtn.removeAttribute('hidden');
  }
  function tick() {
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) { rafId = requestAnimationFrame(tick); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    if (overlay) { overlay.width = video.clientWidth; overlay.height = video.clientHeight; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height, {inversionAttempts:'dontInvert'}) : null;
      if (qr && qr.data) {
        if (octx && overlay) {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          const loc = qr.location;
          drawLine(loc.topLeftCorner, loc.topRightCorner, '#00ff7f');
          drawLine(loc.topRightCorner, loc.bottomRightCorner, '#00ff7f');
          drawLine(loc.bottomRightCorner, loc.bottomLeftCorner, '#00ff7f');
          drawLine(loc.bottomLeftCorner, loc.topLeftCorner, '#00ff7f');
          [['tl',loc.topLeftCorner],['tr',loc.topRightCorner],['br',loc.bottomRightCorner],['bl',loc.bottomLeftCorner]]
            .forEach(([p,c]) => drawCorner(c, p, '#00ff7f'));
        }
        let val = (qr.data || '').trim();
        const mL = val.match(/[?&]lote=([^&#\s]+)/i);
        if (mL) { val = decodeURIComponent(mL[1]); }
        else { const mT = val.match(/\/t\/([^?#\s]+)/i); if (mT) val = decodeURIComponent(mT[1]); }
        stopScan();
        if (lotInput) lotInput.value = val;
        handleLookup(val); setStatus('QR leído.');
        return;
      }
      if (octx && overlay) octx.clearRect(0, 0, overlay.width, overlay.height);
      setStatus('Escaneando...');
    } catch { /* ignorar errores de getImageData */ }
    rafId = requestAnimationFrame(tick);
  }
  function drawLine(b, e, color) {
    if (!octx||!overlay) return;
    const sx = overlay.width/canvas.width; const sy = overlay.height/canvas.height;
    octx.strokeStyle = color; octx.lineWidth = 3; octx.beginPath();
    octx.moveTo(b.x*sx, b.y*sy); octx.lineTo(e.x*sx, e.y*sy); octx.stroke();
  }
  function drawCorner(pt, pos, color) {
    if (!octx||!overlay) return;
    const sx = overlay.width/canvas.width; const sy = overlay.height/canvas.height;
    const x = pt.x*sx; const y = pt.y*sy; const len = 18;
    octx.strokeStyle = color; octx.lineWidth = 4;
    octx.beginPath();
    if (pos==='tl'||pos==='bl') {octx.moveTo(x,y);octx.lineTo(x+len,y);} else {octx.moveTo(x,y);octx.lineTo(x-len,y);}
    octx.stroke();
    octx.beginPath();
    if (pos==='tl'||pos==='tr') {octx.moveTo(x,y);octx.lineTo(x,y+len);} else {octx.moveTo(x,y);octx.lineTo(x,y-len);}
    octx.stroke();
  }

  if (startBtn)   startBtn.addEventListener('click', startScan);
  if (stopBtn)    stopBtn.addEventListener('click', stopScan);
  if (restartBtn) restartBtn.addEventListener('click', () => { restartBtn.setAttribute('hidden',''); startScan(); });

  // ─── Deep link: ?lote=CODE ────────────────────────────────────────
  const _q = new URLSearchParams(location.search).get('lote');
  if (_q) { if (lotInput) lotInput.value = _q; handleLookup(_q); }

})();


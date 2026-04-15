// Trazabilidad — DobleYo Café
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);

  // ─── API ─────────────────────────────────────────────────────────────
  async function lookupCode(code) {
    const trimmed = (code || '').trim();
    if (!trimmed) return null;
    const res = await fetch(`/api/traceability/${encodeURIComponent(trimmed)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Error de red: ' + res.status);
    const json = await res.json();
    return json.success ? json.data : null;
  }

  // ─── Referencias DOM ─────────────────────────────────────────────────
  const video        = $('#qrVideo');
  const startBtn     = $('#startScan');
  const stopBtn      = $('#stopScan');
  const restartBtn   = $('#restartScan');
  const scanLine     = $('#scanLine');
  const scanIdleHint = $('#scanIdleHint');
  const lotInput     = $('#lotInput');
  const lookupBtn    = $('#lookupBtn');
  const lotError     = $('#lotError');
  const resWrap      = $('#result');
  const resEmpty     = $('#resultEmpty');
  const resName      = $('#resName');
  const resLot       = $('#resLot');
  const resChips     = $('#resChips');
  const resRegionBadge   = $('#resRegionBadge');
  const resAltitudeBadge = $('#resAltitudeBadge');
  const resFlavorSection = $('#resFlavorSection');
  const resFlavorChips   = $('#resFlavorChips');
  const resTimeline  = $('#resTimeline');
  const resSCACard   = $('#resSCACard');
  const resSCAMain   = $('#resSCAMain');
  const resSCABars   = $('#resSCABars');
  const shareBtn     = $('#shareBtn');
  const shareBtnLabel = $('#shareBtnLabel');

  // ─── Tabs ────────────────────────────────────────────────────────────
  const tabScan     = $('#tabScan');
  const tabManual   = $('#tabManual');
  const panelScan   = $('#panelScan');
  const panelManual = $('#panelManual');

  function switchTab(tab) {
    const toScan = tab === 'scan';
    tabScan.classList.toggle('active', toScan);
    tabScan.setAttribute('aria-selected', String(toScan));
    tabManual.classList.toggle('active', !toScan);
    tabManual.setAttribute('aria-selected', String(!toScan));
    if (toScan) {
      panelScan.removeAttribute('hidden');
      panelManual.setAttribute('hidden', '');
    } else {
      panelManual.removeAttribute('hidden');
      panelScan.setAttribute('hidden', '');
    }
  }

  tabScan?.addEventListener('click', () => switchTab('scan'));
  tabManual?.addEventListener('click', () => { switchTab('manual'); setTimeout(() => lotInput?.focus(), 50); });

  // ─── Render resultado ────────────────────────────────────────────────
  function renderResult(data) {
    if (!data || !data.harvest) {
      if (resWrap)  resWrap.style.display  = 'none';
      if (resEmpty) resEmpty.style.display = '';
      return;
    }
    if (resEmpty) resEmpty.style.display = 'none';
    if (resWrap)  resWrap.style.display  = '';

    const h      = data.harvest;
    const region = regionLabel(h.region);

    // Hero
    if (resName) resName.textContent = buildLotName(h);
    if (resLot)  resLot.textContent  = (data.lot_code || data.code || '') + (region ? ' · ' + region : '');
    if (resRegionBadge)   resRegionBadge.textContent   = region || 'Colombia';
    if (resAltitudeBadge) {
      if (h.altitude) {
        resAltitudeBadge.textContent   = h.altitude + ' msnm';
        resAltitudeBadge.style.display = '';
      } else {
        resAltitudeBadge.style.display = 'none';
      }
    }

    // Chips de proceso/variedad/finca
    if (resChips) {
      resChips.innerHTML = '';
      [h.process, h.variety, h.farm ? 'Finca ' + h.farm : null]
        .filter(Boolean)
        .forEach(text => {
          const span = document.createElement('span');
          span.className   = 'trace-chip';
          span.textContent = text;
          resChips.appendChild(span);
        });
    }

    // Notas de sabor
    const flavorRaw = data.label?.flavor_notes || h.taste_notes || h.aroma || '';
    if (flavorRaw && resFlavorSection && resFlavorChips) {
      resFlavorSection.style.display = '';
      resFlavorChips.innerHTML = '';
      flavorRaw.split(/[,;·]+/).map(s => s.trim()).filter(Boolean).forEach(note => {
        const span = document.createElement('span');
        span.className   = 'trace-flavor-chip ' + flavorCategory(note);
        span.textContent = note;
        resFlavorChips.appendChild(span);
      });
    } else if (resFlavorSection) {
      resFlavorSection.style.display = 'none';
    }

    // Timeline
    if (resTimeline) {
      resTimeline.innerHTML = '';
      buildStages(data, h).forEach(stage => {
        const li = document.createElement('li');
        li.className = 'trace-timeline-item ' + (stage.done ? 'done' : 'pending');
        li.innerHTML = `
          <div class="trace-timeline-marker">
            <div class="trace-timeline-icon" aria-hidden="true">${stage.icon}</div>
            <div class="trace-timeline-line"></div>
          </div>
          <div class="trace-timeline-content">
            <div class="trace-timeline-stage">${stage.label}</div>
            ${stage.date   ? `<div class="trace-timeline-date">${stage.date}</div>`     : ''}
            ${stage.detail ? `<div class="trace-timeline-detail muted">${stage.detail}</div>` : ''}
          </div>`;
        resTimeline.appendChild(li);
      });
    }

    // SCA
    if (data.packaged?.score) {
      if (resSCACard) resSCACard.style.display = '';
      const score = Number(data.packaged.score);
      if (resSCAMain) {
        const label = score >= 90 ? 'Outstanding' : score >= 85 ? 'Excellent' : score >= 80 ? 'Very Good' : 'Good';
        const pct   = Math.min(100, Math.max(0, ((score - 60) / 40) * 100)).toFixed(1);
        resSCAMain.innerHTML = `
          <div class="trace-sca-score-display">
            <span class="trace-sca-number">${score}</span>
            <span class="trace-sca-max">/100</span>
          </div>
          <div class="trace-sca-label">${label} · Specialty Coffee</div>
          <div class="trace-sca-bar-wrap">
            <div class="trace-sca-bar-fill" style="width:${pct}%"></div>
          </div>`;
      }
      if (resSCABars) {
        resSCABars.innerHTML = '';
        [['Acidez', data.packaged.acidity], ['Cuerpo', data.packaged.body], ['Balance', data.packaged.balance]]
          .forEach(([label, val]) => {
            if (val == null) return;
            const pct = ((Number(val) / 5) * 100).toFixed(1);
            const el  = document.createElement('div');
            el.className = 'trace-sca-attr';
            el.innerHTML = `
              <div class="trace-sca-attr-label">${label}</div>
              <div class="trace-sca-attr-bar"><div class="trace-sca-attr-fill" style="width:${pct}%"></div></div>
              <div class="trace-sca-attr-val">${scoreLabel(val)}</div>`;
            resSCABars.appendChild(el);
          });
        if (data.packaged.package_size) {
          const p = document.createElement('p');
          p.className   = 'trace-sca-package muted';
          p.textContent = 'Presentación: ' + data.packaged.package_size;
          resSCABars.appendChild(p);
        }
      }
    } else {
      if (resSCACard) resSCACard.style.display = 'none';
    }
  }

  // ─── Stages del timeline ──────────────────────────────────────────────
  function buildStages(data, h) {
    const d = (v) => v ? fmtDate(v) : null;
    return [
      {
        label:  'Cosecha',
        icon:   '🌱',
        done:   true,
        date:   d(h.date),
        detail: [h.farm, regionLabel(h.region), h.altitude ? h.altitude + ' msnm' : null].filter(Boolean).join(' · ') || null,
      },
      data.storage
        ? { label: 'Almacén verde', icon: '🏭', done: true,  date: d(data.storage.date), detail: data.storage.location || null }
        : { label: 'Almacén verde', icon: '🏭', done: false, date: null, detail: null },
      data.roasted
        ? {
            label: 'Tueste', icon: '🔥', done: true, date: d(data.roasted.date),
            detail: [
              data.roasted.roast_level,
              data.roasted.actual_temp        ? data.roasted.actual_temp + ' °C'        : null,
              data.roasted.roast_time_minutes ? data.roasted.roast_time_minutes + ' min' : null,
            ].filter(Boolean).join(' · ') || null,
          }
        : { label: 'Tueste', icon: '🔥', done: false, date: null, detail: null },
      data.packaged
        ? { label: 'Control de calidad', icon: '🧪', done: true,  date: null, detail: data.packaged.score ? 'SCA ' + data.packaged.score + '/100' : null }
        : { label: 'Control de calidad', icon: '🧪', done: false, date: null, detail: null },
      data.packaged
        ? { label: 'Empaque', icon: '📦', done: true,  date: null, detail: data.packaged.package_size || null }
        : { label: 'Empaque', icon: '📦', done: false, date: null, detail: null },
      { label: 'En tienda', icon: '🛍️', done: !!data.packaged, date: null, detail: null },
    ];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  function flavorCategory(note) {
    const n = note.toLowerCase();
    if (/panela|miel|caramelo|dulce|azúcar|vainilla/.test(n))           return 'flavor-sweet';
    if (/rojo|fresa|mora|cereza|baya|cítric|naranja|limón|maracuyá|fruta/.test(n)) return 'flavor-fruity';
    if (/chocolate|cacao|nuez|almendra|avellana/.test(n))               return 'flavor-chocolate';
    if (/floral|jazmín|rosa|lavanda/.test(n))                           return 'flavor-floral';
    return '';
  }

  function buildLotName(h) {
    return [regionLabel(h.region), h.variety, h.date && new Date(h.date).getFullYear()]
      .filter(Boolean).join(' — ');
  }

  function regionLabel(code) {
    const m = {
      HUI: 'Huila', NAR: 'Nariño', CAU: 'Cauca', ANT: 'Antioquia', CUN: 'Cundinamarca',
      TOL: 'Tolima', BOY: 'Boyacá', MAG: 'Magdalena', SAN: 'Santander',
      RIS: 'Risaralda', CAL: 'Caldas', QUI: 'Quindío',
    };
    return m[(code || '').toUpperCase()] || code || 'Colombia';
  }

  function scoreLabel(n) {
    return { 1: 'Bajo', 2: 'Medio-bajo', 3: 'Medio', 4: 'Alto', 5: 'Excepcional' }[n] ?? String(n);
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  }

  // ─── Errores y estado ─────────────────────────────────────────────────
  function showLotError(msg) {
    if (!lotError) return;
    lotError.textContent    = msg;
    lotError.style.display  = msg ? '' : 'none';
  }

  function setStatus(t) {
    const el = document.getElementById('scanStatus');
    if (el) el.textContent = t;
  }

  // ─── Lookup manual ────────────────────────────────────────────────────
  async function handleLookup(val) {
    const code = (val || lotInput?.value || '').trim();
    if (!code) { showLotError('Ingresa un código de lote.'); return; }
    showLotError('');
    setStatus('Consultando…');
    if (lookupBtn) { lookupBtn.disabled = true; lookupBtn.textContent = 'Buscando…'; }
    try {
      const data = await lookupCode(code);
      if (!data) {
        showLotError('No se encontró ningún lote con ese código.');
        renderResult(null);
      } else {
        renderResult(data);
        // En mobile, scroll al resultado
        if (window.innerWidth < 1024) {
          document.getElementById('traceResultCol')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } catch {
      showLotError('Error de red. Verifica tu conexión.');
    } finally {
      setStatus('');
      if (lookupBtn) { lookupBtn.disabled = false; lookupBtn.textContent = 'Consultar'; }
    }
  }

  if (lookupBtn) lookupBtn.addEventListener('click', () => handleLookup());
  if (lotInput) {
    lotInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); } });
    lotInput.addEventListener('paste',   () => setTimeout(() => handleLookup(lotInput.value), 0));
  }

  // ─── Escáner QR ───────────────────────────────────────────────────────
  let stream, rafId, canvas, ctx;
  const overlay = document.getElementById('qrOverlay');
  const octx    = overlay?.getContext('2d') ?? null;

  async function startScan() {
    if (scanIdleHint) scanIdleHint.style.display = 'none';
    if (scanLine)  scanLine.removeAttribute('hidden');
    if (startBtn)  startBtn.setAttribute('hidden', '');
    if (stopBtn)   stopBtn.removeAttribute('hidden');
    setStatus('Abriendo cámara…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (video) {
        video.srcObject = stream;
        await video.play();
        if (!canvas) { canvas = document.createElement('canvas'); ctx = canvas.getContext('2d'); }
        tick();
        setStatus('Escaneando… Apunta al código QR.');
      }
    } catch (err) {
      console.warn('[Trazabilidad] Cámara no disponible:', err);
      if (scanLine)     scanLine.setAttribute('hidden', '');
      if (startBtn)     startBtn.removeAttribute('hidden');
      if (stopBtn)      stopBtn.setAttribute('hidden', '');
      if (scanIdleHint) scanIdleHint.style.display = '';
      setStatus('No se pudo acceder a la cámara. Usa el código manual.');
    }
  }

  function stopScan() {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (video)  { video.pause(); video.srcObject = null; }
    if (scanLine)     scanLine.setAttribute('hidden', '');
    if (scanIdleHint) scanIdleHint.style.display = '';
    if (startBtn)     startBtn.removeAttribute('hidden');
    if (stopBtn)      stopBtn.setAttribute('hidden', '');
    if (restartBtn)   restartBtn.setAttribute('hidden', '');
    setStatus('Escaneo detenido.');
  }

  function tick() {
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) { rafId = requestAnimationFrame(tick); return; }
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    if (overlay) { overlay.width = video.clientWidth; overlay.height = video.clientHeight; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = window.jsQR?.(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (qr?.data) {
        if (octx && overlay) {
          octx.clearRect(0, 0, overlay.width, overlay.height);
          const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = qr.location;
          const sx = overlay.width / canvas.width, sy = overlay.height / canvas.height;
          octx.strokeStyle = '#4ade80'; octx.lineWidth = 3;
          [[tl,tr],[tr,br],[br,bl],[bl,tl]].forEach(([a,b]) => {
            octx.beginPath(); octx.moveTo(a.x*sx, a.y*sy); octx.lineTo(b.x*sx, b.y*sy); octx.stroke();
          });
        }
        let val = (qr.data || '').trim();
        const mL = val.match(/[?&]lote=([^&#\s]+)/i);
        if (mL)        { val = decodeURIComponent(mL[1]); }
        else { const mT = val.match(/\/t\/([^?#\s]+)/i); if (mT) val = decodeURIComponent(mT[1]); }
        stopScan();
        if (lotInput) lotInput.value = val;
        switchTab('manual');
        handleLookup(val);
        setStatus('QR leído correctamente.');
        return;
      }
      if (octx && overlay) octx.clearRect(0, 0, overlay.width, overlay.height);
    } catch { /* ignorar errores de getImageData */ }
    rafId = requestAnimationFrame(tick);
  }

  if (startBtn)   startBtn.addEventListener('click',   startScan);
  if (stopBtn)    stopBtn.addEventListener('click',    stopScan);
  if (restartBtn) restartBtn.addEventListener('click', () => { restartBtn.setAttribute('hidden', ''); startScan(); });

  // Auto-iniciar cámara en dispositivos móviles
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    startScan();
  }

  // ─── Compartir ────────────────────────────────────────────────────────
  shareBtn?.addEventListener('click', () => {
    const code = (lotInput?.value || '').trim();
    if (!code) return;
    const url = location.origin + '/trazabilidad?lote=' + encodeURIComponent(code);
    if (navigator.share) {
      navigator.share({ title: 'DobleYo Café — Trazabilidad', text: 'Conoce la historia de este café', url });
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        if (shareBtnLabel) {
          shareBtnLabel.textContent = '¡Enlace copiado!';
          setTimeout(() => { shareBtnLabel.textContent = 'Compartir'; }, 2500);
        }
      });
    }
  });

  // ─── Deep link: ?lote=CODE ────────────────────────────────────────────
  const _q = new URLSearchParams(location.search).get('lote');
  if (_q) {
    if (lotInput) lotInput.value = _q;
    switchTab('manual');
    handleLookup(_q);
  }

})();

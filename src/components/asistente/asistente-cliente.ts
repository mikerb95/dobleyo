// Cliente de la caja del asistente (/admin). Pinta SOLO con nodos y
// textContent: la respuesta viene de un modelo que leyó texto de clientes y
// podría devolver HTML. Los enlaces pasan por rutaSegura().
//
// Flujo: mientras se escribe, el buscador sin IA muestra resultados; con
// Enter se pregunta al asistente (SSE). Si propone un cambio, aparece la
// tarjeta; aprobar o descartar abre otro SSE. Escribir con la tarjeta abierta
// es pedir cambios.

import { bloquesDe, etiquetaPaso, rutaSegura, usd, type Parte } from '../../lib/asistente-texto';

type Vista = {
  tipo: 'cambio';
  rotulo: string;
  titulo: string;
  contexto: string | null;
  cambios: { campo: string; antes: string | null; despues: string | null }[];
  avisos: string[];
  opciones: { id: string; etiqueta: string; valor: boolean }[];
  boton: string;
  nota: string;
};

type Evento =
  | { tipo: 'conversacion'; id: string }
  | { tipo: 'paso'; herramienta: string }
  | { tipo: 'dato' }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'aprobacion'; origen: string; motivo: string; herramienta: string; vista?: Vista }
  | { tipo: 'decision'; aprobado: boolean }
  | { tipo: 'aviso'; texto: string }
  | { tipo: 'fin'; estado: string; error: string | null }
  | { tipo: 'error'; mensaje: string };

type Estado = { disponible: boolean; motivo: string | null; nombre: string; rol: string; atajos: string[] };

const API = '/api/asistente';

// ---- DOM mínimo -------------------------------------------------------------

type Hijo = Node | string | null | undefined | false | Hijo[];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...hijos: Hijo[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else n.setAttribute(k, v);
  }
  // flat(Infinity): una lista de listas pintaba "[object HTMLElement]".
  for (const h of (hijos as unknown[]).flat(Infinity) as (Node | string | null | undefined | false)[]) {
    if (h === null || h === undefined || h === false) continue;
    n.append(typeof h === 'string' ? document.createTextNode(h) : h);
  }
  return n;
}

function partes(lista: Parte[]): Node[] {
  return lista.map((p) => {
    if (p.tipo === 'negrita') return el('strong', {}, p.texto);
    if (p.tipo === 'enlace' && rutaSegura(p.href)) return el('a', { href: p.href }, p.texto);
    return document.createTextNode(p.texto);
  });
}

function pintarTexto(destino: HTMLElement, texto: string) {
  for (const b of bloquesDe(texto)) {
    if (b.tipo === 'parrafo') destino.append(el('p', {}, partes(b.partes)));
    else destino.append(el('ul', {}, b.items.map((item) => el('li', {}, partes(item)))));
  }
}

const hora = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' });

// ---- SSE --------------------------------------------------------------------

async function leerSse(res: Response, alEvento: (e: Evento) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let corte: number;
    while ((corte = buffer.indexOf('\n\n')) >= 0) {
      const bloque = buffer.slice(0, corte).trim();
      buffer = buffer.slice(corte + 2);
      if (!bloque.startsWith('data: ')) continue;
      try {
        alEvento(JSON.parse(bloque.slice(6)) as Evento);
      } catch {
        // Bloque malformado: se ignora.
      }
    }
  }
}

// ---- Caja -------------------------------------------------------------------

export function iniciarAsistente() {
  const raiz = document.getElementById('asistente');
  if (!raiz || raiz.dataset.listo) return;
  raiz.dataset.listo = '1';

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const saludo = $('asis-saludo');
  const sub = $('asis-sub');
  const hilo = $('asis-hilo');
  const form = $<HTMLFormElement>('asis-form');
  const entrada = $<HTMLInputElement>('asis-entrada');
  const enviar = $<HTMLButtonElement>('asis-enviar');
  const resultados = $<HTMLUListElement>('asis-resultados');
  const nota = $('asis-nota');
  const atajos = $('asis-atajos');
  const recientesCaja = $('asis-recientes-caja');
  const recientes = $<HTMLUListElement>('asis-recientes');
  const nueva = $<HTMLAnchorElement>('asis-nueva');
  const consumo = $<HTMLDetailsElement>('asis-consumo');
  const consumoCuerpo = $('asis-consumo-cuerpo');

  let estado: Estado | null = null;
  let convId: string | null = new URLSearchParams(location.search).get('c');
  let corriendo = false;
  let tarjetaAbierta: HTMLElement | null = null;

  const placeholderBase = 'Pregunte o busque algo';

  function modoChat() {
    raiz!.classList.add('is-chat');
    nueva.hidden = false;
  }

  function bloquear(si: boolean) {
    corriendo = si;
    entrada.disabled = si;
    enviar.disabled = si;
    raiz!.dataset.estado = si ? 'respondiendo' : 'listo';
    if (!si) entrada.focus();
  }

  function fijarConversacion(id: string) {
    convId = id;
    const url = new URL(location.href);
    url.searchParams.set('c', id);
    history.replaceState(null, '', url);
  }

  function actualizarPlaceholder() {
    entrada.placeholder = tarjetaAbierta ? 'Si quiere cambiar algo de la propuesta, escríbalo aquí' : convId ? 'Siga la conversación o pregunte otra cosa' : placeholderBase;
    enviar.textContent = estado?.disponible === false ? 'Buscar' : 'Preguntar';
  }

  // ---- Buscador sin IA ------------------------------------------------------

  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let ultimaBusqueda = '';

  function cerrarResultados() {
    resultados.hidden = true;
    resultados.replaceChildren();
    entrada.setAttribute('aria-expanded', 'false');
  }

  async function buscar(q: string) {
    ultimaBusqueda = q;
    try {
      const r = await fetch(`${API}/buscar?q=${encodeURIComponent(q)}`, { credentials: 'same-origin' });
      if (!r.ok || q !== ultimaBusqueda) return;
      const { data } = (await r.json()) as { data: { tipo: string; titulo: string; detalle?: string; enlace: string }[] };
      if (q !== entrada.value.trim()) return;
      resultados.replaceChildren(
        ...data
          .filter((x) => rutaSegura(x.enlace))
          .map((x) =>
            el('li', { role: 'option' },
              el('a', { href: x.enlace },
                el('span', {}, el('span', {}, x.titulo), x.detalle ? el('span', { class: 'asis__res-detalle' }, ` · ${x.detalle}`) : null),
                el('span', { class: 'asis__res-tipo' }, x.tipo),
              ),
            ),
          ),
      );
      resultados.hidden = data.length === 0;
      entrada.setAttribute('aria-expanded', String(data.length > 0));
    } catch {
      // El buscador es una ayuda: si falla, no se interrumpe nada.
    }
  }

  entrada.addEventListener('input', () => {
    clearTimeout(temporizador);
    const q = entrada.value.trim();
    if (q.length < 2 || tarjetaAbierta) return cerrarResultados();
    temporizador = setTimeout(() => buscar(q), 200);
  });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarResultados();
  });
  document.addEventListener('click', (e) => {
    if (!form.contains(e.target as Node)) cerrarResultados();
  });

  // ---- Turnos -----------------------------------------------------------------

  function nuevoTurno(pregunta: string) {
    const pasos = el('ul', { class: 'asis-pasos', 'aria-label': 'Consultas' });
    const respuesta = el('div', { class: 'asis-respuesta' });
    const extra = el('div', { class: 'asis-extra' });
    const turno = el('article', { class: 'asis-turno' }, el('div', { class: 'asis-pregunta' }, pregunta), pasos, respuesta, extra);
    hilo.append(turno);
    modoChat();
    return { turno, pasos, respuesta, extra };
  }

  type Turno = ReturnType<typeof nuevoTurno>;

  function mostrarError(t: Turno, mensaje: string, conVerResultado = false) {
    const caja = el('p', { class: 'asis-error' }, mensaje);
    if (conVerResultado && convId) {
      caja.append(' ', el('a', { href: `/admin?c=${encodeURIComponent(convId)}` }, 'Ver resultado'));
    }
    t.extra.append(caja);
  }

  function sellar(tarjeta: HTMLElement, decision: 'aprobada' | 'descartada' | 'cambios', texto: string) {
    tarjeta.dataset.decision = decision;
    tarjeta.querySelectorAll('button, input').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    tarjeta.querySelector('.asis-tarjeta__acciones')?.remove();
    tarjeta.querySelector('.asis-tarjeta__nota')?.remove();
    tarjeta.append(el('p', { class: 'asis-tarjeta__sello' }, texto));
    if (tarjetaAbierta === tarjeta) tarjetaAbierta = null;
    actualizarPlaceholder();
  }

  function valor(v: string | null, clase: string) {
    return v === null ? el('span', { class: 'asis-vacio' }, 'vacío') : el('span', { class: clase }, v);
  }

  function pintarTarjeta(t: Turno, origen: string, vista?: Vista) {
    const v: Vista = vista ?? { tipo: 'cambio', rotulo: 'Propuesta', titulo: origen, contexto: null, cambios: [], avisos: [], opciones: [], boton: 'Aprobar y guardar', nota: '' };
    const casillas = v.opciones.map((o) => {
      const input = el('input', { type: 'checkbox', name: o.id });
      input.checked = o.valor;
      return { id: o.id, input, label: el('label', {}, input, o.etiqueta) };
    });
    const aprobar = el('button', { class: 'btn btn-primary', type: 'button' }, v.boton || 'Aprobar y guardar');
    const descartar = el('button', { class: 'btn btn-secondary', type: 'button' }, 'Descartar');
    const tarjeta = el('section', { class: 'asis-tarjeta', 'aria-label': `Propuesta: ${v.titulo}` },
      el('header', { class: 'asis-tarjeta__cabeza' },
        el('span', { class: 'asis-tarjeta__rotulo' }, v.rotulo),
        el('h3', { class: 'asis-tarjeta__titulo' }, v.titulo),
        v.contexto ? el('p', { class: 'asis-tarjeta__contexto' }, v.contexto) : null,
      ),
      v.cambios.length
        ? el('table', { class: 'asis-tarjeta__cambios' },
            el('tbody', {}, v.cambios.map((c) =>
              el('tr', {},
                el('th', { scope: 'row' }, c.campo),
                el('td', {}, c.antes !== null ? [valor(c.antes, 'asis-antes'), el('span', { class: 'asis-flecha', 'aria-hidden': 'true' }, '→')] : null, valor(c.despues, 'asis-despues')),
              ),
            )),
          )
        : null,
      v.avisos.length ? el('ul', { class: 'asis-tarjeta__avisos' }, v.avisos.map((a) => el('li', {}, a))) : null,
      casillas.length ? el('div', { class: 'asis-tarjeta__opciones' }, casillas.map((c) => c.label)) : null,
      el('div', { class: 'asis-tarjeta__acciones' }, aprobar, descartar),
      v.nota ? el('p', { class: 'asis-tarjeta__nota' }, v.nota) : null,
    );
    t.extra.append(tarjeta);
    tarjetaAbierta = tarjeta;
    actualizarPlaceholder();

    const decidirCon = async (aprobado: boolean) => {
      if (corriendo || !convId) return;
      const opciones = Object.fromEntries(casillas.map((c) => [c.id, c.input.checked]));
      aprobar.disabled = descartar.disabled = true;
      bloquear(true);
      const seguimiento = el('div', { class: 'asis-respuesta' });
      const espera = el('p', { class: 'asis-escribiendo' }, aprobado ? 'Guardando el cambio…' : 'Descartando…');
      t.extra.append(espera, seguimiento);
      try {
        const res = await fetch(`${API}/decision`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: convId, aprobado, opciones }),
        });
        if (!res.ok) {
          const cuerpo = await res.json().catch(() => ({}));
          espera.remove();
          if (res.status === 409) sellar(tarjeta, 'descartada', 'Esta propuesta ya se decidió en otra pestaña.');
          else aprobar.disabled = descartar.disabled = false;
          mostrarError(t, cuerpo.error ?? 'No se pudo enviar la decisión.');
          return;
        }
        const turnoSeguimiento: Turno = { ...t, respuesta: seguimiento };
        await correr(res, turnoSeguimiento, () => espera.remove(), (ev) => {
          if (ev.tipo === 'decision') sellar(tarjeta, ev.aprobado ? 'aprobada' : 'descartada', ev.aprobado ? `Aprobado por usted, ${hora()}` : 'Descartado');
        });
      } catch {
        espera.remove();
        aprobar.disabled = descartar.disabled = false;
        mostrarError(t, 'Se cortó la conexión.', true);
      } finally {
        bloquear(false);
      }
    };
    aprobar.addEventListener('click', () => decidirCon(true));
    descartar.addEventListener('click', () => decidirCon(false));
  }

  /** Lee el SSE de una pregunta o decisión y lo pinta en el turno. */
  async function correr(res: Response, t: Turno, alPrimerEvento: () => void, extra?: (e: Evento) => void) {
    let cerrado = false;
    let primero = true;
    await leerSse(res, (ev) => {
      if (primero) {
        primero = false;
        alPrimerEvento();
      }
      extra?.(ev);
      switch (ev.tipo) {
        case 'conversacion':
          fijarConversacion(ev.id);
          break;
        case 'paso':
          t.pasos.append(el('li', { class: 'asis-paso' }, etiquetaPaso(ev.herramienta)));
          break;
        case 'texto':
          pintarTexto(t.respuesta, ev.texto);
          break;
        case 'aprobacion':
          cerrado = true;
          pintarTarjeta(t, ev.origen, ev.vista);
          break;
        case 'aviso':
          t.extra.append(el('p', { class: 'asis-aviso', role: 'note' }, ev.texto));
          break;
        case 'fin':
          cerrado = true;
          if (ev.estado === 'fallida') mostrarError(t, ev.error ?? 'El asistente no pudo terminar.');
          break;
        case 'error':
          cerrado = true;
          mostrarError(t, ev.mensaje);
          break;
      }
    });
    if (!cerrado) mostrarError(t, 'Se cortó la conexión, pero la conversación sigue en el servidor.', true);
    cargarRecientes();
  }

  async function preguntar(pregunta: string) {
    if (corriendo) return;
    cerrarResultados();
    const pidiendoCambios = tarjetaAbierta;
    const t = nuevoTurno(pregunta);
    const espera = el('p', { class: 'asis-escribiendo' }, 'Pensando…');
    t.extra.append(espera);
    bloquear(true);
    entrada.value = '';
    try {
      const res = await fetch(API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta, id: convId }),
      });
      if (!res.ok) {
        espera.remove();
        const cuerpo = await res.json().catch(() => ({}));
        if (res.status === 401) return mostrarError(t, 'Su sesión venció. Recargue la página para seguir.');
        if (cuerpo.soloBusca) {
          if (estado) estado.disponible = false;
          nota.textContent = cuerpo.error;
          actualizarPlaceholder();
        }
        if (cuerpo.nueva) convId = null;
        if (cuerpo.recargar && pidiendoCambios) sellar(pidiendoCambios, 'descartada', 'Esta propuesta ya se decidió en otra pestaña.');
        return mostrarError(t, cuerpo.error ?? 'No se pudo enviar la pregunta.');
      }
      if (pidiendoCambios) sellar(pidiendoCambios, 'cambios', 'Pidió cambios');
      await correr(res, t, () => espera.remove());
    } catch {
      espera.remove();
      mostrarError(t, 'Se cortó la conexión.', true);
    } finally {
      bloquear(false);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = entrada.value.trim();
    if (!texto || corriendo) return;
    if (estado && !estado.disponible) {
      // Sin IA la caja solo busca: Enter abre el primer resultado.
      const primero = resultados.querySelector('a');
      if (primero) location.href = primero.getAttribute('href')!;
      else buscar(texto);
      return;
    }
    preguntar(texto);
  });

  // ---- Recientes y retomar ------------------------------------------------------

  async function cargarRecientes() {
    try {
      const r = await fetch(`${API}/recientes`, { credentials: 'same-origin' });
      if (!r.ok) return;
      const { data } = (await r.json()) as { data: { id: string; pregunta: string; esperando: boolean }[] };
      recientes.replaceChildren(
        ...data.map((c) =>
          el('li', {},
            el('a', { href: `/admin?c=${encodeURIComponent(c.id)}`, ...(c.id === convId ? { 'aria-current': 'true' } : {}) },
              el('span', { class: 'asis-rec-texto' }, c.pregunta),
              c.esperando ? el('span', { class: 'asis-rec-marca' }, 'Espera su aprobación') : null,
            ),
          ),
        ),
      );
      recientesCaja.hidden = data.length === 0;
    } catch {
      // Sin recientes no pasa nada.
    }
  }

  async function retomar(id: string) {
    try {
      const r = await fetch(`${API}/conversacion/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
      if (!r.ok) {
        convId = null;
        nota.textContent = 'No encontré esa conversación. Puede empezar otra.';
        return;
      }
      const { data } = await r.json();
      for (const turno of data.turnos as { pregunta: string; respuesta: string; pasos: string[] }[]) {
        const t = nuevoTurno(turno.pregunta);
        for (const p of turno.pasos) t.pasos.append(el('li', { class: 'asis-paso' }, etiquetaPaso(p)));
        pintarTexto(t.respuesta, turno.respuesta);
      }
      const ultimo: Turno | null = hilo.lastElementChild
        ? {
            turno: hilo.lastElementChild as HTMLElement,
            pasos: hilo.lastElementChild.querySelector('.asis-pasos') as HTMLElement,
            respuesta: hilo.lastElementChild.querySelector('.asis-respuesta') as HTMLElement,
            extra: hilo.lastElementChild.querySelector('.asis-extra') as HTMLElement,
          }
        : null;
      if (ultimo && data.aviso) ultimo.extra.append(el('p', { class: 'asis-aviso', role: 'note' }, data.aviso));
      if (ultimo && data.estado === 'fallida' && data.error) mostrarError(ultimo, data.error);
      if (ultimo && data.propuesta) pintarTarjeta(ultimo, data.propuesta.origen, data.propuesta.vista);
      if (data.estado === 'fallida' || data.estado === 'corriendo') {
        nota.textContent = data.estado === 'corriendo' ? 'El asistente todavía está respondiendo; recargue en unos segundos.' : 'Esta conversación terminó con un error. Escriba para empezar otra.';
        if (data.estado === 'fallida') convId = null;
      }
    } catch {
      nota.textContent = 'No se pudo abrir la conversación.';
    }
  }

  // ---- Consumo y topes (solo admin) -------------------------------------------

  async function cargarConsumo() {
    consumoCuerpo.replaceChildren(el('p', { class: 'asis__nota' }, 'Cargando…'));
    try {
      const r = await fetch(`${API}/topes`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error();
      const { data } = await r.json();
      const empresa = el('input', { type: 'number', min: '0', max: String(data.maximoUsd), step: '0.5', value: String(data.empresaUsd), name: 'empresaUsd' });
      const usuario = el('input', { type: 'number', min: '0', max: String(data.maximoUsd), step: '0.5', value: String(data.usuarioUsd), name: 'usuarioUsd' });
      const mensaje = el('p', { class: 'asis__nota', role: 'status' });
      const guardar = el('button', { class: 'btn btn-sm', type: 'submit' }, 'Guardar topes');
      const formTopes = el('form', {}, el('label', {}, 'Tope diario del equipo (USD)', empresa), el('label', {}, 'Tope diario por persona (USD)', usuario), guardar, mensaje);
      formTopes.addEventListener('submit', async (e) => {
        e.preventDefault();
        guardar.disabled = true;
        try {
          const res = await fetch(`${API}/topes`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresaUsd: Number(empresa.value), usuarioUsd: Number(usuario.value) }),
          });
          const cuerpo = await res.json().catch(() => ({}));
          mensaje.textContent = res.ok ? 'Topes guardados.' : cuerpo.error ?? 'No se pudieron guardar.';
        } finally {
          guardar.disabled = false;
        }
      });
      consumoCuerpo.replaceChildren(
        el('dl', {},
          el('dt', {}, 'Gastado hoy (equipo)'), el('dd', {}, `${usd(data.gastoHoyEmpresaUsd)} de ${usd(data.empresaUsd)}`),
          el('dt', {}, 'Este mes'), el('dd', {}, usd(data.mes.usd)),
          el('dt', {}, 'Conversaciones del mes'), el('dd', {}, String(data.mes.conversaciones)),
          data.mes.porUsuario.map((u: { nombre: string; usd: number }) => [el('dt', {}, u.nombre), el('dd', {}, usd(u.usd))]),
        ),
        formTopes,
        el('p', { class: 'asis__nota' }, `Estimado con la tarifa de ${data.modelo} vigente desde ${data.tarifaVigenteDesde}. La cifra oficial es la de la consola de Claude.`),
      );
    } catch {
      consumoCuerpo.replaceChildren(el('p', { class: 'asis__nota' }, 'No se pudo cargar el consumo.'));
    }
  }
  consumo.addEventListener('toggle', () => {
    if (consumo.open) cargarConsumo();
  });

  // ---- Arranque -------------------------------------------------------------------

  (async () => {
    try {
      const r = await fetch(`${API}/estado`, { credentials: 'same-origin' });
      if (!r.ok) {
        raiz!.hidden = true;
        return;
      }
      estado = ((await r.json()) as { data: Estado }).data;
      saludo.textContent = `Hola, ${estado.nombre}`;
      if (estado.rol === 'caficultor') sub.textContent = 'Pregunte por su finca, sus lotes y su café verde.';
      if (!estado.disponible && estado.motivo) nota.textContent = estado.motivo;
      atajos.replaceChildren(
        ...(estado.disponible ? estado.atajos : []).map((a) => {
          const b = el('button', { type: 'button' }, a);
          b.addEventListener('click', () => preguntar(a));
          return b;
        }),
      );
      consumo.hidden = estado.rol !== 'admin';
      raiz!.dataset.estado = 'listo';
      actualizarPlaceholder();
      if (convId) await retomar(convId);
      actualizarPlaceholder();
      cargarRecientes();
      entrada.focus();
    } catch {
      raiz!.hidden = true;
    }
  })();
}

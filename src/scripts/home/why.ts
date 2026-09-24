/**
 * Microdemostraciones de "Por qué elegirnos". Cada una es un bucle corto que
 * solo corre mientras su tarjeta está en pantalla.
 */
import { gsap, gridEntrance, loopWhileVisible, type Piece } from '../motion/core.ts';

export const why: Piece = (addCleanup) => {
  const root = document.querySelector<HTMLElement>('[data-why]');
  if (!root) return;
  const grid = root.querySelector('.why__grid');
  if (grid) gridEntrance(grid);

  // QR: se escanea y el código "llega" descifrándose.
  const qr = root.querySelector<HTMLElement>('[data-demo="qr"]');
  if (qr) {
    const code = qr.querySelector<HTMLElement>('.why-demo__code');
    const final = code?.dataset.final ?? '';
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
    tl.set(code, { opacity: 0 })
      .fromTo(qr.querySelector('.why-demo__scan'), { top: '0%', opacity: 1 }, { top: '100%', opacity: 0.3, duration: 1, ease: 'sine.inOut' })
      .set(code, { opacity: 1 })
      .to(code, { duration: 0.9, scrambleText: { text: final, chars: '0123456789ABCDEFHKLMNPRSTUVXYZ-', speed: 0.6 } });
    loopWhileVisible(qr, tl, addCleanup);
  }

  // 15 días: la ventana se llena desde el día del tueste.
  const days = root.querySelector<HTMLElement>('[data-demo="days"]');
  if (days) {
    const cells = days.querySelectorAll('.why-days li');
    const label = days.querySelector<HTMLElement>('[data-day-label]');
    const prefix = (label?.textContent ?? '').replace(/\d+/, '').trim();
    const counter = { d: 1 };
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4 });
    tl.set(cells, { opacity: 0.18 })
      .set(counter, { d: 1 })
      .to(cells, { opacity: 1, duration: 0.12, stagger: 0.12, ease: 'none' })
      .to(
        counter,
        {
          d: 15,
          duration: 1.8,
          ease: 'none',
          onUpdate: () => label && (label.textContent = `${prefix} ${Math.round(counter.d)}`),
        },
        '<'
      );
    loopWhileVisible(days, tl, addCleanup);
  }

  // Compra directa: el desvío por el intermediario se borra.
  const direct = root.querySelector<HTMLElement>('[data-demo="direct"]');
  if (direct) {
    const detour = direct.querySelector('.why-direct__detour');
    const middle = direct.querySelector('.why-direct__middle');
    const line = direct.querySelector('.why-direct__line');
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.8 });
    tl.set(line, { drawSVG: '0%' })
      .set([detour, middle], { opacity: 1, scale: 1, transformOrigin: '50% 50%' })
      .fromTo(detour, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.8, ease: 'power1.inOut' })
      .to(middle, { scale: 0, opacity: 0, duration: 0.4, ease: 'back.in(2)' }, '+=0.5')
      .to(detour, { opacity: 0, duration: 0.4 }, '<')
      .to(line, { drawSVG: '100%', duration: 0.7, ease: 'power2.out' }, '-=0.1');
    loopWhileVisible(direct, tl, addCleanup);
  }

  // Envío gratis: el carrito sube hasta el umbral y aparece el envío gratis.
  const ship = root.querySelector<HTMLElement>('[data-demo="ship"]');
  if (ship) {
    const threshold = Number(ship.dataset.threshold);
    const en = ship.dataset.lang === 'en';
    const fmt = new Intl.NumberFormat(en ? 'en-US' : 'es-CO', {
      style: 'currency',
      currency: en ? 'USD' : 'COP',
      maximumFractionDigits: 0,
    });
    const amount = ship.querySelector<HTMLElement>('[data-amount]');
    const fill = ship.querySelector('.why-ship__fill');
    const pill = ship.querySelector('.why-ship__pill');
    const cart = { v: 0 };
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
    tl.set(pill, { opacity: 0, scale: 0.8 })
      .set(fill, { scaleX: 0 })
      .set(cart, { v: 0 })
      .to(cart, {
        v: threshold,
        duration: 1.8,
        ease: 'power2.inOut',
        onUpdate: () => {
          // Redondeo a la unidad de precio de cada tienda (mil pesos o un dólar).
          const step = en ? 1 : 1000;
          if (amount) amount.textContent = fmt.format(Math.round(cart.v / step) * step);
        },
      })
      .to(fill, { scaleX: 1, duration: 1.8, ease: 'power2.inOut' }, '<')
      .to(pill, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)' });
    loopWhileVisible(ship, tl, addCleanup);
  }
};

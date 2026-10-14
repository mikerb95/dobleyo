/**
 * Motion de las páginas de compra: tienda (ES y EN), suscripción y regalos.
 * Cada pieza busca su propio marcado y no hace nada si no está en la página.
 */
import '../../styles/motion.css';
import { registerPiece, start } from '../motion/core.ts';
import { counter } from './counter.ts';
import { catalog } from './catalog.ts';

registerPiece(counter);
registerPiece(catalog);
start();

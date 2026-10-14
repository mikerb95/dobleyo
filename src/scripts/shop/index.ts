/**
 * Motion de las páginas de compra: tienda (ES y EN), suscripción y regalos.
 * Cada pieza busca su propio marcado y no hace nada si no está en la página.
 */
import '../../styles/motion.css';
import { registerPiece, start } from '../motion/core.ts';
import { counter } from './counter.ts';
import { catalog } from './catalog.ts';
import { subscription } from './subscription.ts';
import { gifts } from './gifts.ts';

registerPiece(counter);
registerPiece(catalog);
registerPiece(subscription);
registerPiece(gifts);
start();

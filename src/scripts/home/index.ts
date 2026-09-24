/**
 * Motion de la portada (ES y EN comparten este módulo y los mismos componentes).
 * Cada pieza busca su propio marcado y no hace nada si no está en la página.
 */
import '../../styles/motion.css';
import { registerPiece, start } from '../motion/core.ts';
import { hero } from './hero.ts';
import { strip } from './strip.ts';
import { journey } from './journey.ts';
import { manifesto } from './manifesto.ts';
import { farms } from './farms.ts';
import { why } from './why.ts';
import { grids } from './grids.ts';

registerPiece(hero);
registerPiece(strip);
registerPiece(journey);
registerPiece(manifesto);
registerPiece(farms);
registerPiece(why);
registerPiece(grids);
start();

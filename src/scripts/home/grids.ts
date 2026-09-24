/**
 * Rejillas de la portada (cafés, kits, blog, reseñas): entrada escalonada al
 * entrar en pantalla y, en las de producto, luz que sigue al cursor. El botón
 * "+" de cada café es magnético.
 */
import { gridEntrance, cursorLight, magnetic, type Piece } from '../motion/core.ts';

const GRIDS = ['.cs-grid', '.kits-grid', '.blog-home-grid', '.reviews-home-grid'];
const LIT = [
  ['.cs-grid', '.cs-card'],
  ['.kits-grid', '.kit-card'],
];

export const grids: Piece = (addCleanup) => {
  for (const sel of GRIDS) {
    const grid = document.querySelector(sel);
    if (grid) gridEntrance(grid);
  }
  for (const [gridSel, cardSel] of LIT) {
    const grid = document.querySelector<HTMLElement>(gridSel);
    if (grid) cursorLight(grid, cardSel, addCleanup);
  }
  document.querySelectorAll<HTMLElement>('.cs-card__add:not(:disabled)').forEach((btn) => magnetic(btn, addCleanup, 0.4));
};

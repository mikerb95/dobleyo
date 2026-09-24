/**
 * QR real como matriz de módulos, para pintarlo en SVG celda por celda (y
 * poder animar el "descifrado"). Usa qrcode-generator, que ya es dependencia
 * del proyecto por el sistema de etiquetas.
 */
import qrcode from 'qrcode-generator';

export interface QrCell {
  x: number;
  y: number;
  /** Módulo de un patrón de posición (las tres esquinas): se anima aparte. */
  finder: boolean;
}

export interface QrMatrix {
  size: number;
  cells: QrCell[];
}

export function qrMatrix(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'M'): QrMatrix {
  const qr = qrcode(0, level);
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const cells: QrCell[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.isDark(y, x)) cells.push({ x, y, finder: inFinder(x, y) });
    }
  }
  return { size, cells };
}

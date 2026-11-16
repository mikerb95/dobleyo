import { describe, it, expect } from 'vitest';
import { rutaSegura, partesDe, bloquesDe, etiquetaPaso, usd } from '../asistente-texto';

describe('rutaSegura', () => {
  it('acepta rutas del panel y rechaza lo demás', () => {
    expect(rutaSegura('/admin/pedidos')).toBe(true);
    expect(rutaSegura('/admin/produccion?lote=COL-HUI%2D1')).toBe(true);
    expect(rutaSegura('//evil.com')).toBe(false);
    expect(rutaSegura('javascript:alert(1)')).toBe(false);
    expect(rutaSegura('https://dobleyo.cafe/admin')).toBe(false);
    expect(rutaSegura('/admin/"onmouseover=x')).toBe(false);
  });
});

describe('partesDe', () => {
  it('separa texto, negrita y enlaces seguros', () => {
    expect(partesDe('Pedido **DY-1** listo, [ver](/admin/pedidos).')).toEqual([
      { tipo: 'texto', texto: 'Pedido ' },
      { tipo: 'negrita', texto: 'DY-1' },
      { tipo: 'texto', texto: ' listo, ' },
      { tipo: 'enlace', texto: 'ver', href: '/admin/pedidos' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('un enlace externo queda como texto', () => {
    expect(partesDe('[aquí](https://otro.com)')).toEqual([{ tipo: 'texto', texto: 'aquí' }]);
  });

  it('el HTML llega como texto, no como etiqueta', () => {
    expect(partesDe('<img src=x onerror=alert(1)>')).toEqual([{ tipo: 'texto', texto: '<img src=x onerror=alert(1)>' }]);
  });
});

describe('bloquesDe', () => {
  it('arma párrafos y listas', () => {
    const b = bloquesDe('Hay dos pedidos:\n\n- **DY-1**: pagado\n- DY-2: enviado\n\nFin.');
    expect(b.map((x) => x.tipo)).toEqual(['parrafo', 'lista', 'parrafo']);
    expect(b[1]).toMatchObject({ tipo: 'lista', items: [[{ tipo: 'negrita', texto: 'DY-1' }, { tipo: 'texto', texto: ': pagado' }], [{ tipo: 'texto', texto: 'DY-2: enviado' }]] });
  });
});

describe('formato', () => {
  it('etiquetas de paso en lenguaje natural', () => {
    expect(etiquetaPaso('consultar_pedidos')).toBe('Revisando los pedidos');
    expect(etiquetaPaso('desconocida')).toBe('Consultando');
  });

  it('dólares con coma decimal', () => {
    expect(usd(0.4234)).toBe('US$ 0,42');
    expect(usd(3)).toBe('US$ 3,00');
  });
});

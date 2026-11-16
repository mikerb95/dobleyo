// Transmisión en vivo (Server-Sent Events) de lo que hace el asistente, sobre
// la respuesta de Express.
//
// Si el navegador se desconecta a mitad (pestaña cerrada, celular sin señal),
// la tarea NO se cancela: la conversación termina, queda guardada en la base y
// se ve en recientes al volver. Cancelarla dejaría a medias algo ya pagado.

/**
 * @param {import('express').Response} res
 * @param {(enviar: (evento: object) => void) => Promise<void>} tarea
 */
export async function transmitir(res, tarea) {
  let abierto = true;
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.on('close', () => {
    abierto = false;
  });

  const enviar = (evento) => {
    if (!abierto) return;
    try {
      res.write(`data: ${JSON.stringify(evento)}\n\n`);
    } catch {
      abierto = false;
    }
  };

  try {
    await tarea(enviar);
  } catch (err) {
    enviar({ tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) });
  } finally {
    if (abierto) {
      abierto = false;
      res.end();
    }
  }
}

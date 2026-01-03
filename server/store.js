// Almacen de ordenes en memoria (desarrollo)
// Comentarios en espanol sin tildes
export const store = {
  _orders: new Map(),
  setOrder(reference, data){ this._orders.set(reference, { reference, createdAt: Date.now(), ...data }); return this._orders.get(reference); },
  update(reference, patch){ const cur = this._orders.get(reference)||{ reference }; const next = { ...cur, ...patch, updatedAt: Date.now() }; this._orders.set(reference, next); return next; },
  get(reference){ return this._orders.get(reference) || null; }
};

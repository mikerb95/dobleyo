// Utilidades de carrito basico para sitio estatico
// Comentarios en espanol sin tildes
(function(){
  const STORAGE_KEY = 'dbyo-cart';

  function getCart(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []; } catch { return []; }
  }
  function saveCart(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list||[]));
    updateCartCount();
  }
  function addToCart(item){
    // item: {id, name, price, image, qty}
    const cart = getCart();
    const idx = cart.findIndex(p => p.id === item.id);
    if (idx >= 0){ cart[idx].qty = (cart[idx].qty||1) + (item.qty||1); }
    else { cart.push({ id:item.id, name:item.name, price:item.price, image:item.image, qty:item.qty||1 }); }
    saveCart(cart);
  }
  function removeFromCart(id){
    const cart = getCart().filter(p => p.id !== id);
    saveCart(cart);
  }
  function updateQty(id, qty){
    const q = Math.max(1, Math.min(99, parseInt(qty||'1',10)));
    const cart = getCart();
    const it = cart.find(p => p.id === id);
    if (it){ it.qty = q; saveCart(cart); }
  }
  function clearCart(){ saveCart([]); }
  function subtotal(){ return getCart().reduce((s,p)=> s + (p.price||0)*(p.qty||1), 0); }
  function countItems(){ return getCart().reduce((n,p)=> n + (p.qty||1), 0); }
  function updateCartCount(){
    const el = document.getElementById('cartCount');
    if (el) el.textContent = String(countItems());
  }

  // exponer API global
  window.Cart = { getCart, saveCart, addToCart, removeFromCart, updateQty, clearCart, subtotal, countItems, updateCartCount };

  // actualizar contador al cargar
  document.addEventListener('DOMContentLoaded', updateCartCount);
})();

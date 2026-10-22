'use strict';

const products = [...document.querySelectorAll('.product')].map(card => ({
  id: card.dataset.id,
  name: card.querySelector('h3').textContent,
  category: card.dataset.category,
  image: card.querySelector('img').getAttribute('src'),
  card
}));
const byId = new Map(products.map(product => [product.id, product]));
const storageKey = 'vivero-fresia-cart-v1';
let cart = {};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, quantity] of Object.entries(saved)) {
      if (byId.has(id) && Number.isInteger(quantity) && quantity > 0 && quantity <= 99) cart[id] = quantity;
    }
  }
} catch { /* Storage may be unavailable; the cart still works for this visit. */ }

const photoDialog = document.querySelector('#photo-dialog');
const cartDialog = document.querySelector('#cart-dialog');
const expanded = photoDialog.querySelector('.expanded');
for (const dialog of [photoDialog, cartDialog]) {
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
}
document.querySelectorAll('.photo').forEach(button => {
  button.addEventListener('click', () => {
    expanded.src = button.querySelector('img').src;
    expanded.alt = button.dataset.name;
    photoDialog.querySelector('#photo-title').textContent = button.dataset.name;
    photoDialog.showModal();
  });
});
photoDialog.addEventListener('close', () => expanded.removeAttribute('src'));

const status = document.querySelector('#cart-status');
let toastTimer;
function announce(message) {
  clearTimeout(toastTimer);
  status.textContent = message;
  status.classList.add('visible');
  toastTimer = setTimeout(() => status.classList.remove('visible'), 3500);
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function changeQuantity(id, quantity) {
  if (quantity <= 0) delete cart[id];
  else cart[id] = Math.min(99, quantity);
  try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch { /* In-memory fallback. */ }
  renderCart();
}
function renderCart() {
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  document.querySelector('.cart-count').textContent = count;
  document.querySelector('.cart-trigger').setAttribute('aria-label', `Mi carrito, ${count} productos`);
  const list = document.querySelector('#cart-items');
  list.replaceChildren();
  for (const [id, quantity] of Object.entries(cart)) {
    const product = byId.get(id);
    const row = element('article', '', 'cart-item');
    const image = element('img');
    image.src = product.image;
    image.alt = '';
    row.append(image);
    const info = element('div', '', 'cart-item-info');
    info.append(element('h3', product.name), element('p', 'Precio a confirmar'));
    const controls = element('div', '', 'quantity');
    const minus = element('button', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', `Disminuir cantidad de ${product.name}`);
    minus.disabled = quantity === 1;
    minus.addEventListener('click', () => {
      changeQuantity(id, quantity - 1);
      list.querySelector(`[data-quantity="${id}"]`)?.focus();
    });
    const number = element('span', String(quantity));
    number.setAttribute('aria-label', `Cantidad: ${quantity}`);
    const plus = element('button', '+');
    plus.type = 'button';
    plus.dataset.quantity = id;
    plus.setAttribute('aria-label', `Aumentar cantidad de ${product.name}`);
    plus.disabled = quantity === 99;
    plus.addEventListener('click', () => {
      changeQuantity(id, quantity + 1);
      const target = list.querySelector(`[data-quantity="${id}"]`);
      (target.disabled ? cartDialog.querySelector('.close') : target).focus();
    });
    controls.append(minus, number, plus);
    const remove = element('button', 'Quitar', 'remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Quitar ${product.name} del carrito`);
    remove.addEventListener('click', () => {
      changeQuantity(id, 0);
      cartDialog.querySelector('.close').focus();
      announce(`${product.name} se quitó del carrito.`);
    });
    info.append(controls, remove);
    row.append(info);
    list.append(row);
  }
  document.querySelector('#cart-empty').hidden = count > 0;
  document.querySelector('#cart-summary').hidden = count === 0;
  const checkout = document.querySelector('#checkout');
  if (count) {
    const lines = Object.entries(cart).map(([id, quantity]) => `• ${quantity} × ${byId.get(id).name}`);
    const message = `Hola, Vivero Fresia. Quisiera realizar este pedido:\n\n${lines.join('\n')}\n\n¿Me confirman precios, disponibilidad y cómo coordinar la compra?`;
    checkout.href = `https://wa.me/56945973179?text=${encodeURIComponent(message)}`;
  } else checkout.removeAttribute('href');
}

document.querySelector('.cart-trigger').hidden = false;
document.querySelector('.cart-trigger').addEventListener('click', () => cartDialog.showModal());
document.querySelectorAll('[data-add]').forEach(button => {
  button.hidden = false;
  const product = byId.get(button.dataset.add);
  button.setAttribute('aria-label', `Agregar ${product.name} al carrito`);
  button.addEventListener('click', () => {
    if (cart[product.id] === 99) return announce('Puedes agregar hasta 99 unidades por producto.');
    changeQuantity(product.id, (cart[product.id] || 0) + 1);
    announce(`${product.name} se agregó al carrito.`);
  });
});
renderCart();

document.querySelector('.shop-tools').hidden = false;
let category = 'Todos';
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function filterProducts() {
  const query = normalize(document.querySelector('#search').value.trim());
  let count = 0;
  products.forEach(product => {
    const matches = (category === 'Todos' || product.category === category) && normalize(product.name).includes(query);
    product.card.hidden = !matches;
    if (matches) count++;
  });
  document.querySelector('#result-count').textContent = `${count} ${count === 1 ? 'producto' : 'productos'}`;
  document.querySelector('.empty-results').hidden = count > 0;
}
document.querySelector('#search').addEventListener('input', filterProducts);
document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    category = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    filterProducts();
  });
});
filterProducts();

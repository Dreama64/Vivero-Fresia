'use strict';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const pesos = value => value === null ? 'Precio a consultar' : new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(value);
function productCard(p) {
  const name = escape(p.name);
  return `<article class="product" data-id="${escape(p.id)}" data-category="${escape(p.category)}" data-price="${p.price ?? ''}" data-available="${Boolean(p.available)}"><button class="photo" type="button" data-name="${name}" aria-label="Ampliar imagen de ${name}"><img src="${escape(p.image)}" alt="${name}" width="640" height="800" loading="lazy" decoding="async"></button><div class="product-info"><p class="product-category">${escape(p.category)}</p><h3>${name}</h3>${p.description ? `<p class="product-description">${escape(p.description)}</p>` : ''}<p class="price-note">${pesos(p.price)}</p>${p.available ? '' : '<p class="sold-out">Agotado</p>'}<a href="https://wa.me/56945973179?text=${encodeURIComponent('Hola, quisiera consultar por ' + p.name + '.')}" target="_blank" rel="noopener noreferrer">Consultar este producto ↗</a><button class="add button" type="button" data-add="${escape(p.id)}" ${p.available ? '' : 'disabled'} hidden>${p.available ? 'Agregar al carrito +' : 'Agotado'}</button></div></article>`;
}
function storefront(template, products) {
  const categories = ['Todos', ...new Set(products.map(p => p.category))];
  return template.replace(/<div class="grid">[\s\S]*?<\/div><p class="empty-results"/, `<div class="grid">${products.map(productCard).join('\n')}</div><p class="empty-results"`)
    .replace(/(<div class="filters"[^>]*>)[\s\S]*?(<\/div><p id="result-count")/, (_, open, close) => open + categories.map(c => `<button type="button" class="filter" data-filter="${escape(c)}" aria-pressed="${c === 'Todos'}">${escape(c)}</button>`).join('') + close);
}
module.exports = { storefront, pesos };

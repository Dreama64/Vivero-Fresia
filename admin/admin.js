'use strict';
const $ = selector => document.querySelector(selector);
let csrf = '';
let products = [];
let editing = null;
let pendingDelete = null;
let uploadedImage = '';
let busy = false;
function message(text, error = false) { $('#message').textContent = text; $('#message').classList.toggle('error',error); }
function loginView() { $('#login-panel').hidden=false; $('#dashboard').hidden=true; $('#editor').hidden=true; $('#logout').hidden=true; }
async function api(route, method = 'GET', body) {
  const response = await fetch(route,{method,headers:{...(body ? {'Content-Type':'application/json'} : {}),...(method !== 'GET' ? {'X-CSRF-Token':csrf} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
  const data = await response.json();
  if (!response.ok) { if (response.status === 401 && route !== '/api/login') loginView(); throw new Error(data.error || 'No se pudo completar la acción.'); }
  return data;
}
function node(tag,text,className) { const el=document.createElement(tag); if(text) el.textContent=text; if(className) el.className=className; return el; }
const money = value => value === null ? 'Precio a consultar' : new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function button(text, label, action, danger=false) { const el=node('button',text,danger ? 'danger' : ''); el.type='button'; el.setAttribute('aria-label',label); el.addEventListener('click',action); return el; }
function render() {
  const list=$('#product-list'); list.replaceChildren();
  const query=normalize($('#admin-search').value);
  const filtered=products.filter(p => normalize(p.name+' '+p.category).includes(query));
  $('#list-count').textContent=`${filtered.length} productos`;
  for(const p of filtered) {
    const row=node('article','','admin-product'); const image=node('img'); image.src=p.image; image.alt=''; image.loading='lazy';
    const details=node('div','','product-details'); details.append(node('h3',p.name),node('p',p.category+' · '+money(p.price)));
    const badges=node('div','','badges'); badges.append(node('span',p.visible ? 'Visible' : 'Oculto','badge'),node('span',p.available ? 'Disponible' : 'Agotado','badge')); details.append(badges);
    const actions=node('div','','row-actions');
    actions.append(button('Editar',`Editar ${p.name}`,()=>openEditor(p)),button(p.visible ? 'Ocultar' : 'Mostrar',`${p.visible ? 'Ocultar' : 'Mostrar'} ${p.name}`,()=>update(p,{visible:!p.visible})),button(p.available ? 'Marcar agotado' : 'Marcar disponible',`Cambiar disponibilidad de ${p.name}`,()=>update(p,{available:!p.available})),button('Eliminar',`Eliminar ${p.name}`,()=>{pendingDelete=p; $('#delete-description').textContent=p.name; $('#delete-dialog').showModal();},true));
    row.append(image,details,actions); list.append(row);
  }
  if(!filtered.length) list.append(node('p','No hay productos que coincidan.'));
}
async function load() { products=await api('/api/products'); render(); $('#dashboard').hidden=false; $('#login-panel').hidden=true; $('#logout').hidden=false; }
async function update(product, change) {
  if(busy) return; busy=true;
  try { await api('/api/products/'+product.id,'PUT',{...product,...change}); await load(); message('Producto actualizado. Ya puedes verlo en la tienda.'); }
  catch(error) { message(error.message,true); } finally { busy=false; }
}
function openEditor(product=null) {
  editing=product; uploadedImage=product?.image || ''; $('#product-form').reset(); $('#editor-title').textContent=product ? 'Editar producto' : 'Agregar producto';
  for(const key of ['name','category','description']) $('#'+key).value=product?.[key] || '';
  $('#price').value=product?.price ?? ''; $('#available').checked=product?.available ?? true; $('#visible').checked=product?.visible ?? true;
  $('#photo-preview').hidden=!uploadedImage; if(uploadedImage) $('#photo-preview').src=uploadedImage; else $('#photo-preview').removeAttribute('src');
  const options=$('#categories'); options.replaceChildren(); [...new Set(products.map(p=>p.category))].forEach(c=>{const option=node('option'); option.value=c; options.append(option);});
  $('#editor').hidden=false; $('#dashboard').hidden=true; message(''); $('#editor-title').focus();
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault(); const submit=$('#login-form button'); submit.disabled=true;
  try { const result=await api('/api/login','POST',{password:$('#password').value}); csrf=result.csrf; $('#password').value=''; await load(); message('Sesión iniciada.'); }
  catch(error) { message(error.message,true); } finally { submit.disabled=false; }
});
$('#logout').addEventListener('click',async()=>{try{await api('/api/logout','POST',{}); csrf=''; products=[]; $('#product-list').replaceChildren(); $('#product-form').reset(); loginView(); message('Sesión cerrada.');}catch(error){message(error.message,true);}});
$('#admin-search').addEventListener('input',render);
$('#new-product').addEventListener('click',()=>openEditor());
$('#refresh').addEventListener('click',()=>load().then(()=>message('Lista actualizada.')).catch(error=>message(error.message,true)));
$('#cancel-edit').addEventListener('click',()=>{if(busy)return; $('#editor').hidden=true; $('#dashboard').hidden=false; $('#new-product').focus();});
$('#photo').addEventListener('change',async()=>{
  const file=$('#photo').files[0]; if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>20*1024*1024) { message('Elige una foto JPG, PNG o WebP de hasta 20 MB.',true); $('#photo').value=''; return; }
  const save=$('#save-product'); save.disabled=true; $('#photo').disabled=true; busy=true;
  let bitmap;
  try {
    message('Preparando fotografía…'); bitmap=await createImageBitmap(file);
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale)); canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/webp',.82);
    if(!data.startsWith('data:image/webp;base64,'))throw new Error('Este navegador no puede optimizar la foto. Prueba con un navegador actualizado.');
    const result=await api('/api/images','POST',{image:data.split(',')[1]}); uploadedImage=result.image; $('#photo-preview').src=uploadedImage; $('#photo-preview').hidden=false; message('Foto lista. Guarda el producto para aplicar los cambios.');
  } catch(error) { message(error.message || 'No se pudo preparar la fotografía.',true); $('#photo').value=''; }
  finally { bitmap?.close(); save.disabled=false; $('#photo').disabled=false; busy=false; }
});
$('#product-form').addEventListener('submit',async event=>{
  event.preventDefault(); if(busy)return;
  if(!uploadedImage)return message('Agrega una foto antes de guardar el producto.',true);
  busy=true; $('#save-product').disabled=true;
  const body={name:$('#name').value,category:$('#category').value,description:$('#description').value,price:$('#price').value==='' ? null : Number($('#price').value),image:uploadedImage,available:$('#available').checked,visible:$('#visible').checked,...(editing ? {version:editing.version}: {})};
  try { await api('/api/products'+(editing ? '/'+editing.id : ''),editing ? 'PUT':'POST',body); $('#editor').hidden=true; await load(); message('Producto guardado. La tienda ya está actualizada.'); $('#new-product').focus(); }
  catch(error) { message(error.message,true); } finally { busy=false; $('#save-product').disabled=false; }
});
$('#cancel-delete').addEventListener('click',()=>$('#delete-dialog').close());
$('#confirm-delete').addEventListener('click',async()=>{
  if(busy)return; busy=true; $('#confirm-delete').disabled=true;
  try {await api('/api/products/'+pendingDelete.id,'DELETE',{version:pendingDelete.version}); $('#delete-dialog').close(); await load(); message('Producto eliminado.'); $('#new-product').focus();}
  catch(error){$('#delete-dialog').close();message(error.message,true);} finally {busy=false;$('#confirm-delete').disabled=false;}
});
(async()=>{try{const result=await api('/api/session'); if(result.authenticated){csrf=result.csrf;await load();}else loginView();}catch(error){loginView();message('No se pudo conectar con el servidor. Este panel necesita el alojamiento configurado.',true);}})();

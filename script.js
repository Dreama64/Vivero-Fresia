'use strict';
const dialog = document.querySelector('dialog');
const expanded = dialog.querySelector('.expanded');
const title = dialog.querySelector('#photo-title');
document.querySelectorAll('.photo').forEach((button) => {
  button.addEventListener('click', () => {
    expanded.src = button.querySelector('img').src;
    expanded.alt = button.dataset.name;
    title.textContent = button.dataset.name;
    dialog.showModal();
  });
});
dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog.addEventListener('close', () => expanded.removeAttribute('src'));

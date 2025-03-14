const imagenes = document.querySelectorAll('.imagen');
const contenedorImagenExpandida = document.querySelector('.imagen-expandida');
const imagenGrande = document.querySelector('.imagen-grande');
const botonCerrar = document.querySelector('.cerrar');
const whatsappBtn = document.querySelector('#whatsapp-btn');

imagenes.forEach((imagen) => {
  imagen.addEventListener('click', function() {
    contenedorImagenExpandida.style.display = 'flex';
    imagenGrande.src = imagen.src;
  });
});

botonCerrar.addEventListener('click', function() {
  contenedorImagenExpandida.style.display = 'none';
});

whatsappBtn.addEventListener('click', function() {
  const numeroTelefono = '+56945973179';
  const mensaje = 'Hola, estoy interesado en contactar con Vivero Fresia.';
  const url = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
});

document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("scrollTopBtn");

  window.onscroll = function () {
      if (document.documentElement.scrollTop > 200) {
          btn.style.display = "block";
      } else {
          btn.style.display = "none";
      }
  };

  btn.onclick = function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
  };
});

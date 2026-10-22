# Vivero Fresia

Tienda campestre para un vivero de Picarquín, San Francisco de Mostazal. Mantiene HTML, CSS y JavaScript sin framework e incorpora un servidor Node.js 24 con SQLite para administrar productos y fotografías.

## Uso

```sh
npm run setup
npm start
```

Tienda: `http://127.0.0.1:8768`. Panel privado: `http://127.0.0.1:8768/admin`. La primera configuración pide una contraseña; no hay credenciales por defecto. Los datos se guardan en `data/` por defecto, excluido de Git. En producción debe configurarse un disco persistente y HTTPS.

- [Guía para administrar productos](ADMINISTRACION.md)
- [Alojamiento, acceso, respaldos y pruebas](ALOJAMIENTO.md)

## Funciones

- Portada natural y campestre, catálogo adaptable, categorías y búsqueda tolerante a tildes.
- Carrito persistente en el navegador con cantidades y pedido conjunto por WhatsApp.
- Panel para subir fotografías, crear y editar productos, categorías, descripción y precio en CLP; marcar agotado, ocultar o eliminar con confirmación.
- Productos y fotografías guardados en el servidor y disponibles desde otros dispositivos. Los cambios se ven al recargar la tienda.
- Precio opcional: si falta, se muestra «Precio a consultar» y no se inventa total. Si todos los productos del carrito tienen precio, se calcula el total de productos. La compra y sus condiciones se confirman por WhatsApp; no hay cobro ni reserva automática.
- Imágenes originales preservadas; 21 copias WebP utilizadas reducen el peso un 44 % frente a sus originales. Las fotos nuevas se optimizan antes de subirlas.
- Textos alternativos, navegación con teclado, diálogos nativos con retorno de foco, enlace para saltar contenido y movimiento reducido.
- Título, descripción, idioma es-CL y metadatos básicos. Panel sin indexación; no se inventa dominio canónico ni ubicación exacta.

Se conservan los 18 productos y el contacto originales, pendientes de confirmar su vigencia y nombres botánicos. No se agregan precios ni condiciones comerciales ficticias. Se corrigen HTML inválido, precios vacíos, enlaces sociales a videos, música automática y la ampliación de fotos inaccesible del sitio original.

## Arquitectura

- `index.html`, `styles.css`, `shop.css`, `script.js`: tienda. El servidor inserta el catálogo público actualizado en el HTML para que también esté disponible sin JavaScript.
- `admin/`: interfaz del panel. Los datos y las escrituras se protegen en el servidor, no solo ocultando la interfaz.
- `server/`: HTTP, sesiones, validación, fotos, renderizado y SQLite. Sin dependencias de ejecución externas.
- `catalog.seed.json`: importación inicial, una sola vez, de los productos originales.
- `data/`: SQLite, sesiones y fotos subidas; nunca incluir en un repositorio público.
- `tests/`: pruebas de servidor, tienda y panel.

La copia HTML también puede abrirse como sitio estático de referencia, pero no recibirá cambios del panel. Para ofrecer administración se debe usar el servidor Node, no GitHub Pages ni el servidor estático de Python.

## Validación

`npm test` verifica acceso privado, protección de archivos, origen y CSRF, subida de foto, validación de precio, texto escapado, edición, ocultación, agotados, conflictos de versión, persistencia tras reiniciar, eliminación, logout y límite de intentos.

Las pruebas de tienda cubren 320, 390, 768 y 1440 px: catálogo, imágenes, anclas, búsqueda, categorías, carrito persistente, cantidades, resultados vacíos, mensajes de WhatsApp, navegación con teclado y almacenamiento bloqueado/corrupto. El panel se prueba a 390 y 1440 px: login, foto, creación, precio, total del carrito, agotado, ocultación, edición, confirmación de borrado y cierre de sesión.

Se comprueban además la sintaxis JavaScript y `git diff --check`. La revisión de accesibilidad es parcial. Las pruebas no envían mensajes ni verifican que el número de WhatsApp siga siendo atendido.

No hay hosting contratado ni despliegue de producción. Los cambios se entregan en el pull request para revisión; fusionar y publicar requiere aprobación del usuario.

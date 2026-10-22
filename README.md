# Vivero Fresia

Sitio estático en HTML, CSS y JavaScript para Vivero Fresia, en Picarquín, San Francisco de Mostazal, Chile. No requiere compilación ni servicios externos para mostrar el catálogo.

## Vista previa local

Desde esta carpeta, ejecutar `python -m http.server 8000` y abrir `http://localhost:8000`. No se configura un despliegue nuevo ni se modifica producción en esta propuesta.

## Cambios de interfaz y funcionamiento

- Diseño adaptable con navegación visible, galería, historia y contacto.
- Se conservan los 15 nombres de plantas y las tres conservas del sitio original. No se inventan precios, stock, horarios ni dirección exacta. Los nombres botánicos requieren confirmación del propietario.
- WhatsApp usa el número del JavaScript original y mensajes específicos para cada producto. El enlace permite consultar; no constituye una compra ni garantiza disponibilidad.
- Se retiran los precios vacíos, el mapa sin implementar, el carácter suelto del encabezado y los enlaces sociales que apuntaban a videos o a una sección de un perfil personal. Confirmar perfiles comerciales antes de reincorporarlos.
- Se elimina la reproducción musical al primer clic y el carrusel automático. Los archivos originales permanecen disponibles en el repositorio.
- Fotografías ampliables mediante botones y diálogo nativo: teclado, Escape, foco contenido en el diálogo y retorno de foco al cerrarlo.
- Enlace para saltar al contenido, foco visible, textos alternativos, jerarquía de encabezados y respeto por movimiento reducido.
- Título y descripción únicos, idioma es-CL, metadatos Open Graph básicos y favicon. No se añade dominio canónico, ubicación exacta ni datos estructurados comerciales sin confirmación.
- Copias WebP de las fotografías utilizadas: 1.446.624 bytes frente a 2.584.666 bytes de sus originales (44 % menos). Carga diferida salvo logo y portada, sin fuentes remotas ni bibliotecas de interfaz.

## Pruebas

No existían pruebas, gestor de paquetes ni flujo de integración continua en la versión original. Se agrega una prueba de navegador reproducible:

```sh
npm install
npx playwright install chromium
npm test
```

Se puede usar Chrome instalado mediante `BROWSER_CHANNEL=chrome`. El entorno de revisión utilizó Playwright del runtime compartido mediante `PLAYWRIGHT_MODULE`, sin instalar dependencias en el sitio.

Resultado: pruebas aprobadas en 320, 390, 768 y 1440 px: sin desbordamiento horizontal, 18 productos presentes, imágenes cargadas, anclas válidas, enlaces de WhatsApp con número y mensaje, apertura por teclado, cierre con Escape y botón, y recuperación del foco. Catálogo y contacto disponibles con JavaScript desactivado. Sin errores de JavaScript ni respuestas HTTP fallidas en estas pruebas. También se verifican `node --check script.js` y `git diff --check`.

Las pruebas no envían mensajes ni verifican que el número siga siendo atendido. La revisión de accesibilidad es parcial, no una certificación. El propietario debe confirmar nombres de productos, vigencia del contacto y fotografías de portada (ya presentes en el sitio original) antes de publicar.

## Archivos

- `index.html`: contenido estático indexable.
- `styles.css`: diseño y adaptación a pantallas.
- `script.js`: ampliación de fotografías.
- `imagenes/web/`: versiones optimizadas; originales preservados en `imagenes/`.
- `tests/browser.cjs`: revisión funcional en Chromium.

La propuesta se entrega en una rama y un pull request. Fusionar o publicar requiere aprobación del usuario.

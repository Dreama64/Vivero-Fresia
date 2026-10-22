# Instalación y operación

## Requisitos

- Node.js 24, con `node:sqlite` incluido; versión probada: 24.18.0.
- Un servidor Node persistente, una sola instancia y un disco persistente con permisos de escritura.
- HTTPS delante de Node para publicación. `PUBLIC_ORIGIN` debe ser el origen público exacto, sin ruta ni barra final.
- Base de datos SQLite y fotos en la carpeta `DATA_DIR`. No usar discos efímeros ni compartir SQLite entre múltiples servidores.

GitHub Pages no ejecuta este servidor. No se ha contratado hosting, registrado dominio ni publicado producción. La elección del proveedor queda pendiente de acuerdo con el usuario. No hay dependencia de un proveedor de base de datos externo.

## Probar en el computador

```sh
npm run setup
npm start
```

`setup` pide una contraseña de 12 a 200 caracteres sin mostrarla y guarda únicamente su derivación con scrypt y sal aleatoria. No hay contraseña predeterminada. Si se omite la configuración, la tienda abre pero el inicio de sesión permanece deshabilitado.

Abrir `http://127.0.0.1:8768` y `http://127.0.0.1:8768/admin`. Para otro puerto, configurar `PORT`. No usar el servidor estático de Python para probar el panel.

Las operaciones del navegador requieren el mismo origen. Si se cambia a otra dirección de acceso, configurar `PUBLIC_ORIGIN` con esa dirección. En desarrollo el acceso admitido por defecto es `http://127.0.0.1:PUERTO`.

## Publicar más adelante

1. Revisar y aprobar el pull request. No publicar sin aprobación del usuario.
2. Crear un volumen persistente y configurar `DATA_DIR` fuera del código servido, por ejemplo `/var/lib/vivero`.
3. Configurar `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT` según el hosting y `PUBLIC_ORIGIN=https://dominio-confirmado`. `.env.example` contiene un ejemplo, no valores comerciales reales. Los archivos `.env` no se cargan automáticamente: configurar el entorno en el hosting o usar las opciones de Node apropiadas.
4. Ejecutar `npm run setup` de forma interactiva con el mismo `DATA_DIR`. Se puede configurar antes de activar `NODE_ENV=production`.
5. Iniciar con `npm start` y configurar HTTPS y reinicio automático en el alojamiento elegido. Node rechaza el arranque en producción sin un origen HTTPS.
6. Comprobar login, creación de un producto oculto con foto, edición, visibilidad, carrito, WhatsApp y persistencia tras un reinicio. No guardar productos ficticios visibles como prueba de producción.

No hay paquetes de ejecución externos. Playwright es una dependencia de desarrollo para pruebas. En Node 24 la API SQLite es experimental; está aislada en `server/database.cjs` para facilitar actualizaciones y requiere pruebas al cambiar de versión de Node.

## Datos, copias y restauración

En el primer arranque se importan una sola vez los 18 productos de `catalog.seed.json`, con sus identificadores originales y sin precios inventados. Después, SQLite es la fuente de verdad. Editar el seed o los archivos HTML no actualiza productos existentes en la base de datos.

Respaldar **toda** la carpeta `DATA_DIR`, incluyendo base de datos, archivos auxiliares SQLite y `images/`. Para una copia coherente sencilla, detener Node, copiar la carpeta completa a un lugar privado y volver a iniciarlo. No copiar únicamente el archivo SQLite mientras está recibiendo escrituras. Al restaurar, detener Node, restaurar la carpeta completa y comprobar los permisos antes de arrancar. Probar restauraciones regularmente.

Los productos eliminados desaparecen de la base de datos, pero sus fotos se conservan en disco para evitar romper referencias a imágenes compartidas y permitir recuperación desde respaldos. También pueden quedar fotos subidas si se cancela una edición. Supervisar espacio; la limpieza de fotos huérfanas debe hacerse con copia previa y revisión de referencias. No hay borrado automático de fotos ni restauración de registros eliminados en la interfaz.

Restablecer contraseña: ejecutar `npm run setup` con el mismo `DATA_DIR`. Esto cambia la contraseña y revoca todas las sesiones existentes. La configuración inicial solo es accesible desde una terminal, no desde un endpoint público.

## Protección y límites

- Un único administrador mediante contraseña; sin registro público ni recuperación por correo.
- Cookie HttpOnly y SameSite=Strict; Secure en producción. Sesiones aleatorias de ocho horas con tokens derivados en la base de datos. Logout revoca la sesión.
- Verificación de origen y token CSRF en escrituras. Sin CORS abierto.
- Límite de intentos de login por dirección de conexión; cinco intentos fallidos en quince minutos. Detrás de un proxy el límite puede compartirse entre usuarios. No se confía en cabeceras de IP enviadas por clientes.
- Consultas parametrizadas, validación de precios, texto escapado y comprobación atómica de versión ante ediciones simultáneas.
- Archivos del servidor, SQLite, seed y configuración no se sirven por HTTP. Las imágenes subidas son públicas por URL, aunque el producto esté oculto: no subir documentos privados.
- Fotos: JPG/PNG/WebP de hasta 20 MB en el navegador, conversión a WebP de hasta 1600 px y hasta 2 MB en el servidor. El servidor comprueba el contenedor WebP y usa nombres aleatorios; no acepta SVG ni HTML. El soporte de formatos del celular depende del navegador; HEIC no está soportado directamente.
- Encabezados de seguridad y panel excluido de indexación. No hay sincronización en tiempo real: los clientes deben recargar para ver cambios. El carrito siempre requiere confirmar disponibilidad; no es un control de stock transaccional.

## Pruebas

```sh
npm test
npm install
npx playwright install chromium
npm run test:browser
npm run test:admin
```

El runtime de revisión aporta Playwright mediante `PLAYWRIGHT_MODULE` y Chrome mediante `BROWSER_CHANNEL=chrome`. Las pruebas usan carpetas temporales y credenciales ficticias aisladas, sin modificar el catálogo real.

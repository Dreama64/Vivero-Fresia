# Render: despliegue independiente de Vivero Fresia

Estado: preparado, sin recursos nuevos creados. La creación requiere autorización del costo por parte del propietario. Configuración de revisión: `deploy/render-plan.json` (no ejecutable ni Blueprint).

## Límite de alcance

Crear un servicio web **nuevo** llamado `vivero-fresia`. No modificar, suspender, eliminar, renombrar, cambiar el plan, repositorio ni variables de `servidor-colectivos-la-punta` o `servidor-colectivos`. No enlazar grupos de entorno compartidos ni copiar sus credenciales. El plan anterior de reutilizar Colectivos queda descartado.

## Presupuesto a aprobar

Estimación al 23 de octubre de 2026, precios en USD:

| Concepto nuevo del vivero | Base mensual |
|---|---:|
| Servicio web 0.5 CPU / 512 MB, una instancia | US$7,00 |
| Disco persistente de 1 GB | US$0,25 |
| Herramientas propias de respaldo y copias manuales a un computador propio | US$0,00 adicionales |
| **Base estimada del vivero** | **US$7,25** |

Es un gasto adicional al de los servicios existentes. No incluye impuestos, conversión de moneda, dominio ni excesos de cuotas de transferencia/compilación compartidas del workspace. Se confirmará el resumen del Dashboard antes de contratar. Sin nuevo plan de workspace, Postgres, Redis, cron ni almacenamiento externo. El costo cero del respaldo supone espacio propio disponible y copias manuales, no un servicio externo ni una operación automática garantizada.

Referencias: https://render.com/pricing y https://render.com/docs/disks. Las instantáneas del disco son adicionales a nuestro respaldo coherente; no sustituyen una copia privada fuera de Render para recuperar SQLite.

## 1. Revisar y preparar GitHub

Revisar el PR de preparación y fusionarlo en `main` antes del despliegue. No se necesita modificar otros repositorios. Node 24 se selecciona con `NODE_VERSION=24` y el rango existente en package.json. Mantener una sola instancia.

## 2. Crear solo después de aprobar el presupuesto

En **New → Web Service**, seleccionar `Dreama64/Vivero-Fresia`, rama `main`, runtime Node, directorio raíz vacío y plan de 512 MB. Build: `npm install --omit=dev`. Start: `npm start`. Sin pre-deploy command. Añadir durante la creación un disco de **1 GB** en **/var/data**, y Health Check Path **/healthz**. Si se crea por una herramienta que no admite disco, no usar el panel para cargar productos hasta que el disco esté adjunto y verificado.

Variables exclusivas del nuevo servicio:

| Variable | Valor |
|---|---|
| NODE_VERSION | 24 |
| NODE_ENV | production |
| HOST | 0.0.0.0 |
| DATA_DIR | /var/data |
| PORT | Lo suministra Render; no fijarlo al puerto local 8768 |
| PUBLIC_ORIGIN | URL HTTPS real del servicio, sin barra final |

El nombre solicitado no garantiza que la URL sea exactamente `vivero-fresia.onrender.com`. Si Render aún no muestra la dirección al crear el servicio, el código puede usar temporalmente su variable oficial `RENDER_EXTERNAL_URL`. Después de crearlo, leer la URL real, establecer `PUBLIC_ORIGIN` con ese valor y desplegar la configuración. Nunca derivar el origen del encabezado Host del visitante. No guardar literalmente los marcadores del JSON como variables.

Mantener Auto-Deploy desactivado durante la validación; activar despliegues desde `main` después de aprobar la puesta en marcha. Con disco habrá una interrupción breve durante cada despliegue. La persistencia no implica disponibilidad sin interrupciones.

## 3. Crear contraseña sin exponerla

Con el servicio iniciado y el disco montado, abrir la **Shell del nuevo vivero** y ejecutar:

```sh
npm run setup
```

El propietario escribe dos veces su nueva contraseña de 12 a 200 caracteres. No se muestra en pantalla; se almacena su derivación con scrypt y sal aleatoria. No poner la contraseña en comandos, GitHub, variables, capturas, chat ni logs. No usar la contraseña de la prueba local. La tienda funciona antes de configurarla, pero el login queda deshabilitado.

No ejecutar setup durante el build, pre-deploy ni en One-Off Jobs: esas instancias no tienen acceso al disco. En una recuperación, el mismo procedimiento restablece la contraseña y revoca las sesiones. El cambio de contraseña y la revocación se guardan en una sola transacción.

## 4. Comprobar producción

1. Esperar a que el despliegue concreto esté **Live** y `/healthz` responda 200. Revisar logs sin exponer secretos.
2. Abrir tienda y catálogo; comprobar imágenes, navegación, buscador y categorías en móvil/escritorio.
3. Abrir `/admin`, entrar con la contraseña elegida y crear un producto de prueba **oculto** con foto. Comprobar edición y precio; no inventar productos ni precios visibles públicamente.
4. Con los productos reales autorizados, comprobar carrito y mensaje de WhatsApp sin enviarlo. Revisar campos del editor y cierre de sesión. Las pruebas locales ya ejercitan precio, carrito, agotados y ocultación usando datos ficticios aislados.
5. Reiniciar el servicio nuevo; comprobar que el registro oculto y su imagen continúan. Desplegar de nuevo el mismo commit/configuración y repetir la comprobación. Registrar resultados antes de dar por terminada la publicación.
6. Ejecutar un respaldo, descargarlo y restaurarlo en un directorio/entorno de ensayo; comprobar integridad, catálogo y foto. No restaurar encima de la base en uso.
7. Comprobar solo en lectura que los dos servicios de Colectivos mantienen sus identificadores, repositorios, planes y configuración. No reiniciarlos para comparar.

## 5. Respaldos y recuperación

Desde la Shell del vivero, `npm run backup` crea en `/var/data/backups/FECHA/` una copia SQLite mediante la API nativa de backup, fotos y `manifest.json` con hashes SHA-256. No copia en caliente el archivo SQLite directamente. Las fotos son inmutables y la aplicación no las borra, por lo que copiarlas después de la instantánea incluye las referenciadas por el catálogo. No ejecutar limpieza de fotos mientras se respalda. Las sesiones se eliminan de la copia, no del servicio activo.

Política inicial sin servicios adicionales: generar y descargar una copia **cada día con cambios y antes de actualizar**, a una carpeta privada de un computador propio; conservar siete copias diarias y cuatro semanales fuera de Render. Comprobar al menos una restauración mensual. Mantener como máximo una copia ya descargada en el disco del servicio para no llenarlo; su limpieza debe hacerse manualmente sobre la carpeta exacta revisada. El procedimiento no agenda ni ejecuta respaldos automáticamente. Si se desea automatizar respaldo externo, se aprobará primero el destino, acceso y eventual costo.

La copia contiene datos del catálogo y la derivación de la contraseña: no subirla a GitHub ni servirla por URL pública. Transferirla por SSH/SCP autenticado de Render, con permisos privados; no compartir claves en el chat. Un respaldo que permanece únicamente en el mismo disco no protege de pérdida del servicio/cuenta/disco. El original del código y las imágenes iniciales se recupera del commit de GitHub anotado en el manifiesto.

Restauración ensayada:

```sh
npm run restore -- /ruta/privada/respaldo /ruta/nueva/datos-recuperados
```

La herramienta verifica hashes, integridad SQLite y fotos referenciadas antes de copiar y exige un destino inexistente. No sobrescribe una base activa. Para recuperación real: detener escrituras del **vivero**, conservar sus datos actuales, restaurar en una carpeta nueva bajo el disco persistente, cambiar solo su `DATA_DIR` a esa carpeta y desplegar. Verificar tienda, foto y login; si hace falta restablecer contraseña con setup. Registrar el tiempo recuperado: se pierden los cambios posteriores a la última copia. No usar una restauración de snapshot de disco como sustituto de este procedimiento SQLite.

## 6. Dominio .cl más adelante

No se compra dominio ahora. Cuando el propietario tenga uno, agregarlo únicamente al nuevo servicio, configurar los registros DNS que indique Render, verificar HTTPS y cambiar `PUBLIC_ORIGIN` al origen canónico HTTPS del dominio. Desplegar y volver a probar login, escrituras y WhatsApp. Evitar administrar desde la URL antigua mientras el origen canónico sea el nuevo. El registro/renovación del dominio se presupuesta por separado.

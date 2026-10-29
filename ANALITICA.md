# Medición de visitas: Cloudflare Web Analytics

Integración opcional y gratuita para la tienda Node.js. No requiere cambiar DNS. La revisión del 29 de octubre de 2026 no encontró medición en el código ni en el HTML público de https://viverofresia.cl. El panel de Cloudflare no se ha inspeccionado: revisar allí antes de activar.

## Activación pendiente del propietario

1. En https://dash.cloudflare.com entra en **Web Analytics**, revisa si ya existe `viverofresia.cl` y úsalo; si no, elige **Add a site**, agrega ese hostname y confirma.
2. En **Manage site**, elige instalación manual (**Enable with JS Snippet installation**, si aparece). Desactiva la inyección automática para este sitio antes de usar la integración del repositorio. No combines ambos métodos ni agregues otro snippet al HTML.
3. Copia únicamente el valor `token` de `data-cf-beacon` del snippet. Es el identificador público de Web Analytics, NO una API key, Global API Key ni contraseña.
4. En Render, servicio `vivero-fresia` → **Environment**, agrega `CLOUDFLARE_WEB_ANALYTICS_TOKEN` con ese valor. Conserva `NODE_ENV=production` y `PUBLIC_ORIGIN=https://viverofresia.cl`. Publica primero la rama aprobada en `main` y despliega ese commit; coordina el guardado del entorno con ese despliegue para evitar publicar código anterior.
5. Abre la tienda y comprueba en las herramientas de red del navegador un único `beacon.min.js` y envíos a `https://cloudflareinsights.com/cdn-cgi/rum`. Espera unos minutos y confirma datos en Cloudflare. Los bloqueadores pueden impedir la medición.

Solo las respuestas `/` y `/index.html` incluyen el beacon. El administrador y las API conservan su política de seguridad; las vistas locales no se miden. El token vacío desactiva la integración; un token mal formado impide arrancar para evitar publicar una configuración inválida. No hay servicios de compilación ni dependencias nuevas: se ejecuta directamente con Node 24.

## Dónde ver visitas

Cloudflare → **Web Analytics** → **viverofresia.cl**. Revisa **Visits** (visitas), **Page views** (páginas vistas), el gráfico por fecha y el desglose por ruta. Cambia el intervalo para comparar días o semanas. Estas cifras no identifican personas únicas y una persona puede generar varias visitas o páginas vistas. La tienda usa una sola página: navegar por secciones o abrir el carrito no equivale a otra página, y esta integración no registra compras ni clics de WhatsApp.

Los datos comienzan después de la activación; no recuperan visitas anteriores. Comprobar recepción real requiere el token y acceso al panel. Para desactivar, elimina la variable del servicio y vuelve a desplegar.

Documentación: https://developers.cloudflare.com/web-analytics/get-started/

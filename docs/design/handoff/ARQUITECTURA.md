# Documentos Vaticanos — base de arquitectura compartida (Web + Android con Capacitor)

## Principio
Una sola base de código web (HTML/CSS/JS) que se empaqueta sin cambios como app Android mediante Capacitor. Nada de lógica específica de plataforma en la UI.

## Capas
1. **Datos** — `documentos.js`: catálogo y texto de los documentos como módulo ES puro. Es la única fuente de verdad; la web y la app lo consumen igual. Para textos largos, cada documento puede migrarse a un JSON por documento (`docs/<id>.json`) cargado bajo demanda.
2. **Estado / persistencia** — `localStorage` con claves con prefijo `dv.`:
   - `dv.settings` → `{ size, theme, font }` (ajustes de lectura)
   - `dv.nav` → `{ view, docId }` (última pantalla abierta)
   - `dv.pos.<docId>` → posición de scroll (continuar la lectura)
   En Capacitor, `localStorage` funciona; si se requiere durabilidad garantizada, cambiar solo esta capa por `@capacitor/preferences` (misma interfaz get/set).
3. **UI** — la aplicación de lectura (portada, biblioteca, lector). Sin dependencias de red: funciona offline por diseño.

## Empaquetado Android (pasos)
```
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Documentos Vaticanos" dev.munin.documentosvaticanos --web-dir=www
# copiar los archivos web (html, js) a www/
npx cap add android
npx cap sync && npx cap open android
```

## Reglas para mantener la base compartida
- Sin APIs de navegador no soportadas por WebView Android.
- Rutas relativas siempre; sin URLs absolutas a recursos locales.
- Tipografías empaquetadas localmente antes de publicar (hoy se cargan de Google Fonts; para offline, descargar los .woff2 a `fonts/` y cambiar el `@font-face`).
- Áreas táctiles ≥ 44px; la UI ya lo cumple.
- Todo acceso a plataforma (compartir, preferencias, archivos) pasa por un único módulo adaptador si llega a necesitarse.

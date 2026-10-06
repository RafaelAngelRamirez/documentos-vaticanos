# Auditoría de Documentos Vaticanos

Fecha de lectura: 2026-10-06. El código de producto no se modificó. Cada hallazgo dice qué está débil y qué cambio lo mejoraría.

La prueba en vivo fue el lector web empaquetado, dos veces, en `http://127.0.0.1:4219/leyendo/cic-es/punto/2`. Las dos veces el resultado fue el mismo. `app-punto` visible, `.bnav` ausente, URL igual a la pedida, y el texto de *Laetamur magnopere* en pantalla. El chrome de esa corrida, con `uiLocale` fijado a `es`, decía `Índice`, `Marcadores` e `Inicio del documento`. Electron y el emulador Android no se arrancaron en esta máquina.

## Lógica de negocio

### Las referencias personales no existen sin API

`ReferencesService` solo habla con `GET/POST/DELETE /me/references`. No hay clave de `localStorage`. El merge de sesión, en `sync.service.ts`, envía anotaciones (`dv_anotaciones_v1`) y temas (`themes.user`) y no envía referencias.

Qué está débil. En `/cuenta/referencias` el lector anónimo ve «Aún no tienes referencias» aunque el resto de la app lee sin red. La estrella Guardar no tiene un camino offline equivalente al de las notas.

Qué lo mejora. Guardar la referencia en local con `documentId` y `unitIndex`, y añadir esa lista al cuerpo de `POST /api/v1/sync/merge` cuando haya sesión.

Archivos. `frontend/src/app/core/account/references.service.ts` líneas 21-25. `frontend/src/app/services/sync.service.ts` líneas 10-15. `frontend/src/app/pages/mis-referencias/mis-referencias.component.html` líneas 13-18.

### Dos temas con el mismo título se pisan en el merge

En `backend/src/routes/sync.ts`, si el id local no está en la nube, el servidor busca otro tema del mismo usuario con el mismo `title` y, si lo encuentra, lo trata como el mismo registro.

Qué está débil. Un tema nuevo con un título ya usado actualiza el tema viejo en lugar de crear uno. Los pasos del tema nuevo pueden reemplazar los del viejo cuando el `updatedAt` local gana.

Qué lo mejora. Emparejar solo por id. Si el id no existe, crear. Un título repetido es válido.

Archivo. `backend/src/routes/sync.ts` líneas 195-204 y 228-229.

### Empate de `updatedAt` descarta el dispositivo

Si la marca de tiempo local no es estrictamente mayor que la de la nube, la anotación local se ignora. El comentario del código lo dice. «Igual o más antigua que la nube → gana la nube».

Qué está débil. Dos ediciones en el mismo milisegundo, o un reloj atrasado, pierden el texto del teléfono sin aviso.

Qué lo mejora. En empate, conservar el registro que tenga `nota` o `excerpt` más largo, o un contador de revisión que no dependa del reloj.

Archivo. `backend/src/routes/sync.ts` líneas 169-184.

### La ficha de estudio no muestra el error si el estudio no cargó

La plantilla de detalle envuelve título y error en `*ngIf="!loading && study"`. El editor hace lo mismo con `Editar estudio`.

Qué está débil. En `/estudios/:id` y `/estudios/:id/editar`, sin API, la ruta queda en blanco. El usuario no ve por qué.

Qué lo mejora. Pintar `error` y un enlace de vuelta a `/estudios` fuera de ese `ngIf`.

Archivos. `frontend/src/app/pages/estudio-detalle/estudio-detalle.component.html` líneas 1 y 25. `frontend/src/app/pages/estudio-editar/estudio-editar.component.html` línea 1.

### El tema inexistente también queda mudo

En `/cuenta/temas/:id` el bloque de lectura está dentro de `*ngIf="theme as t"`. El `error` de la carga fallida queda en ramas que no se muestran si `theme` es nulo.

Qué está débil. Un id desconocido abre la barra y nada más.

Qué lo mejora. Un estado vacío con el texto de `error` y un enlace a `/cuenta/temas`.

Archivo. `frontend/src/app/pages/tema-detalle/tema-detalle.component.html` línea 86.

### La cola de revisión pierde la URL pedida

Sin sesión, `admin/revision` y `admin/revision/:id` hacen `navigate(['/cuenta'])`. Con sesión y sin rol admin, el texto es `Se requiere rol admin`.

Qué está débil. Después de entrar, no hay vuelta a la cola. El anónimo no distingue «hace falta cuenta» de «esta URL no existe».

Qué lo mejora. Guardar `returnUrl` y, si el rol no alcanza, dejar el mensaje en la propia ruta en lugar de redirigir.

Archivo. `frontend/src/app/pages/admin-revision/admin-revision.component.ts` líneas 34-39. El detalle repite el patrón en `admin-revision-detalle.component.ts` líneas 34-40.

### El primer arranque no fija el español de la interfaz

`DEFAULT_READER_PREFERENCES.uiLocale` es `es`, pero `load()` sin `localStorage` aplica el idioma del dispositivo.

Qué está débil. En un navegador en inglés la primera visita muestra `en.json` (`Start of the document`, `Index`, `Bookmarks`) aunque el corpus de trabajo y la regla de producto tratan el español como idioma principal. La corrida en vivo lo confirmó antes de fijar `reader.prefs.v1`. Con `uiLocale: es` el mismo URL mostró `Inicio del documento`.

Qué lo mejora. En el primer arranque dejar `uiLocale` en `es` y ofrecer el cambio en `/ajustes`. El contenido puede seguir en `system`.

Archivo. `frontend/src/app/services/reader-preferences.service.ts` líneas 57-59 y 291-296. Cadena española en `frontend/src/assets/i18n/es.json` línea 77 (`reader.doc_start`).

## Crecimiento del corpus e integración en la app

### El manifest nombra cuerpos que el checkout no trae

`manifest.json` de assets declara `cic-es` con `bodyPath` `documents/cic-es/content.json` y `unitCount` 5092. `.gitignore` excluye `frontend/src/assets/corpus/documents/`. El pack canónico sí está en `documentos/corpus/documents/cic-es/`. `scripts/dev.sh` llama a `corpus-sync-assets.sh` antes de servir.

Qué está débil. Quien arranca `ng serve` sin esa sync (el `webServer` de Playwright en `e2e/playwright.config.ts` hace exactamente eso) publica un manifest cuyo cuerpo no está. El lector de `cic-es` falla aunque el id exista.

Qué lo mejora. Hacer que el servidor de verificación y el `ng serve` de e2e fallen con un mensaje si falta el `bodyPath`, o que invoquen `corpus-sync-assets.sh` antes de escuchar.

Archivos. `frontend/src/assets/corpus/manifest.json` (objeto `cic-es`). `.gitignore` línea 75. `scripts/dev.sh` línea 94. `e2e/playwright.config.ts` líneas 26-33. `scripts/corpus-sync-assets.sh` líneas 1-6.

### Los cinco idiomas de producto no van a la par

Conteo del mismo `manifest.json` (1446 documentos). `en` 538, `es` 427, `ar` 171, `zh` 145, `hi` 135, `la` 25. Además hay piezas sueltas fuera de esos códigos. `igmr-fr` (`fr`), `igmr-it` (`it`), `missale-romanum-apc-de` (`de`), `missale-romanum-apc-pt` (`pt`).

Qué está débil. Un documento «canónico» en español no tiene gemelo en los cinco locales. El lector que cambia `contentLocale` pierde obras. Los cuatro códigos sueltos no tienen ficha de idioma en el producto.

Qué lo mejora. Un informe de paridad en el pipeline (id base, locales presentes, `sourceNote` si la traducción no es oficial) y no publicar un locale suelto sin decisión.

Archivo. `frontend/src/assets/corpus/manifest.json`.

### El Catecismo que se leyó en vivo no viaja en trozos

El directorio canónico `documentos/corpus/documents/cic-es/` contiene `content.json`, `index.json` y `meta.json`. No hay `chunks.json`. El cargador prefiere trozos y, si no hay spec, cae al JSON completo. El comentario del código habla de no parsear un array de 10–20 MB.

Qué está débil. Abrir `/leyendo/cic-es/punto/2` (5092 unidades) parsea el cuerpo entero para pintar una ventana. La corrida en vivo sí mostró el texto, así que el fallback funciona, pero el coste es el del archivo completo.

Qué lo mejora. Generar `chunks.json` para los packs grandes en `corpus:sync-assets` o en el empaquetado, y no dar por cerrado un pack de lectura sin trozos cuando `unitCount` pase un umbral.

Archivos. `frontend/src/app/core/corpus/corpus-load.logic.ts` líneas 873-877. `documentos/corpus/documents/cic-es/content.json`.

### Santos y papas no usan la ventana del lector

`CorpusService.ensureWindow` y `ensureUnits`, si el id es de santo o de papa, llaman a `ensureLoaded` y cargan el documento entero.

Qué está débil. El lector inmersivo de una bio larga no comparte el camino de ventana del magisterio. Hoy las bios son cortas. El día que crezcan, el primer paint espera al paquete completo.

Qué lo mejora. Pasar las bios sintéticas por el mismo `ensureWindow` cuando tengan `unitCount` alto.

Archivo. `frontend/src/app/core/corpus/corpus.service.ts` líneas 262-264 y 276-278.

## Optimización y buenas prácticas

### La búsqueda puede pedir el índice de cada obra del locale

`ensureIndexForLocale` toma el manifest, filtra por idioma y llama a `ensureIndexMany` con todos esos ids. No baja `content.json`, pero un locale `en` son 538 índices.

Qué está débil. La primera búsqueda en `/buscar` espera una cola de cientos de `index.json` antes de ordenar bien.

Qué lo mejora. Un índice agregado por locale (el grafo y los postings de temas ya van por ese camino) y cargar el `index.json` de una obra solo al abrir el resultado.

Archivo. `frontend/src/app/core/corpus/corpus.service.ts` líneas 301-318.

### La ventana del lector ya existe y el empaquetado no la alimenta

`ensureWindow` calcula `from`/`to` y `loadWindow` pide solo esos trozos si hay `chunks.json`. Sin trozos, `loadPackedBody` lee el cuerpo completo. El Catecismo de la prueba en vivo está en ese segundo camino.

Qué está débil. El código de ventana está escrito y el pack que más se abre no lo usa.

Qué lo mejora. El mismo umbral de trozos del apartado anterior, medido con el tiempo hasta el primer `app-punto` en `/leyendo/cic-es/punto/2`.

Archivo. `frontend/src/app/core/corpus/corpus-load.logic.ts` líneas 627-643 y 873-877.

### El merge de anotaciones escribe de una en una

El bucle de `sync.ts` hace `create` o `update` por anotación, en serie, dentro de la petición.

Qué está débil. Un lector con muchos subrayados bloquea el login en una transacción larga de ida y vuelta a Postgres.

Qué lo mejora. Un `createMany` para las nuevas y una transacción por lote para las actualizadas.

Archivo. `backend/src/routes/sync.ts` líneas 164-182.

## Visual web

La corrida en vivo usó viewport 1280×800. En `/leyendo/cic-es/punto/2` se vio el chrome de escritorio del lector (`Índice`, `Marcadores`, `Aa`) y no la barra inferior. Eso coincide con `.desktop-wbar`, oculto bajo 1024 px y visible desde ahí, y con la ruta inmersiva, que no monta `app-bnav`.

### Filas de biblioteca alineadas a la izquierda física

`.docrow` y `.bh` fijan `text-align: left`. El árabe sí pone `dir="rtl"` en el documento (`applyDocumentLangDir`).

Qué está débil. En `/biblioteca` y en listas que reutilizan `.docrow`, el texto árabe sigue pegado al borde izquierdo.

Qué lo mejora. `text-align: start` en esas reglas.

Archivos. `frontend/src/styles.css` líneas 165 y 174. `frontend/src/app/core/i18n/ui-i18n.logic.ts` líneas 70-79.

### La nota de revisión usa un borde físico y un hex suelto

`.revnote` pinta `border-left: 3px solid #9a7328`. `.p-rev` repite el mismo hex.

Qué está débil. En `/admin/revision` y en los temas en revisión el acento no voltea con `dir`, y el color no sale de un token. En `mono` y `claro` el dorado fijo puede perder contraste.

Qué lo mejora. `border-inline-start` y un token de acento de revisión. `.quote` ya usa `border-inline-start` (línea 340). La nota debería seguir ese patrón.

Archivo. `frontend/src/styles.css` líneas 412-417.

### La barra de escritorio empuja la búsqueda con margen físico

`.wsearch` tiene `margin-left: auto` en el componente de la barra.

Qué está débil. Con `uiLocale` `ar`, en cualquier ruta de escritorio que monta `app-wbar` (inicio, biblioteca, padres, papas), el campo Buscar no se ancla al borde de inicio de la escritura.

Qué lo mejora. `margin-inline-start: auto`.

Archivo. `frontend/src/app/components/wbar/wbar.component.ts` líneas 158-160.

## Visual escritorio

Electron no se lanzó. Lo que sigue sale del proceso principal.

### No hay menú de aplicación

`main.js` crea la ventana y no importa `Menu`. En Linux y Windows Electron deja el menú genérico (File, Edit, View).

Qué está débil. El escritorio muestra una barra que no conoce Inicio, Biblioteca ni Buscar. Esas entradas viven solo en el `wbar` de la página web.

Qué lo mejora. `Menu.setApplicationMenu` con esas tres rutas, o quitar el menú genérico si el `wbar` es la única navegación.

Archivo. `frontend/electron/main.js` líneas 1-9 y 72-85. No hay ninguna llamada a `Menu`.

### La ventana puede encogerse al layout de teléfono

`minWidth` es 360 y `minHeight` 480. La barra de escritorio aparece desde 1024 px. Por debajo, la misma ventana muestra `fbar` y `bnav`.

Qué está débil. Un usuario de escritorio que estrecha la ventana cae en el chrome móvil sin un menú nativo que lo saque.

Qué lo mejora. `minWidth` de 1024 si el producto de escritorio es el shell ancho, o un menú nativo que siga visible en el ancho estrecho.

Archivo. `frontend/electron/main.js` líneas 72-76. Umbral en `frontend/src/app/components/wbar/wbar.component.ts` líneas 130-136.

## Visual móvil

El emulador no se lanzó. El WebView carga el mismo CSS. El botón atrás nativo sí está cableado.

### Las etiquetas de la barra inferior son de 11 px

`.bitem` usa `font-size: 11px` con `padding: 12px 0 14px`. Las cuatro entradas son Inicio, Biblioteca, Estudio y Ajustes. En el WebView y en el navegador estrecho esa es la navegación principal.

Qué está débil. A 11 px la etiqueta compite mal con el icono de 18 px. El área táctil ronda la altura del padding más el icono y puede quedar justa frente a los 48 px del grupo 7C.

Qué lo mejora. Subir la etiqueta a 12 o 13 px y dar a `.bitem` un `min-height` de 48 px, medido en un viewport de 390 px de ancho.

Archivo. `frontend/src/styles.css` líneas 342-345. Plantilla en `frontend/src/app/components/bnav/bnav.component.ts` líneas 25-57.

### El interruptor de Ajustes no espeja

`.sw2::after` coloca el círculo con `left: 3px`.

Qué está débil. En `/ajustes`, con `dir="rtl"`, la perilla sigue anclada a la izquierda física. El estado encendido y apagado se lee al revés.

Qué lo mejora. Posicionar con `inset-inline-start`, o voltear con `[dir="rtl"]`.

Archivo. `frontend/src/styles.css` líneas 359 y 361. El estado apagado usa `left: 3px`. El estado encendido usa `right: 3px`. Ninguno sigue `dir`.

### El retroceso nativo sí cierra overlays antes de salir

`BackService.init` registra `App.addListener('backButton')` solo en plataforma nativa y delega en `handleBack`.

Qué está bien. No hace falta un botón atrás distinto en el APK para las hojas. El hueco móvil que sí queda es de tipografía y de dirección, no de ausencia del gesto.

Archivo. `frontend/src/app/services/back.service.ts` líneas 57-64.

### Un número en la URL del lector gana al consecutivo

`/leyendo/:id/punto/:user` interpreta el segmento como índice del arreglo cuando `Number(routePunto)` es finito y esa casilla existe. Solo si no existe busca `consecutivo`.

Qué está débil. Una cita humana como `CIC 27` o `Gn 1` puede abrir la unidad 27 o la unidad 1, no el párrafo cuyo `consecutivo` es ese rótulo. La corrida en vivo pidió el índice `2` a propósito y mostró el arranque del Catecismo. No demuestra que un consecutivo numérico caiga en la unidad correcta.

Qué lo mejora. La URL debe llevar `unitIndex`. El consecutivo queda como etiqueta, y la ventana se pide con el índice ya resuelto.

Archivo. `frontend/src/app/components/lector/lector.component.ts` líneas 906-914.

### Entrar a Cuenta sin red cierra la sesión

`refreshMe` hace `logout()` en cualquier error de `GET /me`, sin mirar el código HTTP.

Qué está débil. Con token guardado y la API caída, `/cuenta` borra access, refresh y usuario. El lector sigue, pero la sesión no.

Qué lo mejora. Cerrar sesión solo ante 401. Un fallo de red deja el usuario en local y la pantalla en modo offline.

Archivo. `frontend/src/app/core/auth/auth.service.ts` líneas 80-83.

### La referencia de nube rechaza el id de una bio

El alta exige `documentId` contra `/^[a-z0-9-]+$/i`. Los ids de ficha son `santoral:{id}` y `papacy:{id}`.

Qué está débil. Guardar desde el lector de una bio responde 400. El marcador local sí queda. En otro dispositivo la referencia no existe.

Qué lo mejora. Aceptar esos ids sintéticos. La cita sigue siendo `documentId` más `unitIndex`.

Archivo. `backend/src/routes/references.ts` líneas 33-35.

### Una nota antigua se vuelve «la más nueva» al abrir la app

Si falta `updatedAt`, la carga de anotaciones escribe la hora actual y la persiste.

Qué está débil. El merge trata esa hora como la última edición. Un subrayado viejo de este aparato pisa la versión ya corregida en otro dispositivo.

Qué lo mejora. Rellenar el hueco una sola vez con `createdAt`, no con `new Date()`.

Archivo. `frontend/src/app/services/anotaciones.service.ts` líneas 116-123.

### Hay fichas con prosa y sin entrada al lector

Ignacio de Antioquía muestra una cita (`Carta a los Esmirniotas, 8`) y cuatro cartas sin `documentId`. El CTA `Comenzar la lectura` está bajo `*ngIf="primaryWorkId"`.

Qué está débil. En `/padres/ignacio-antioquia` el párrafo se lee en la ficha y no se puede abrir ni escuchar en el lector. La misma compuerta está en la ficha de doctor.

Qué lo mejora. Si hay cita y no hay pack, escuchar esa prosa con el narrador del lector y, cuando el texto sea largo, una unidad sintética con `documentId` estable.

Archivos. `frontend/src/app/data/padres.ts` líneas 42-49. `frontend/src/app/pages/padre-detalle/padre-detalle.component.html` línea 16.

### El service worker precarga todo `assets`

El grupo `assets` de `ngsw-config.json` usa `updateMode: prefetch` sobre `/assets/**`.

Qué está débil. Una actualización de la PWA intenta bajar el corpus entero, no solo el shell. En el teléfono eso compite con la primera lectura.

Qué lo mejora. Dejar los cuerpos de `documents/**` fuera del precache y bajarlos al abrir la obra.

Archivo. `frontend/ngsw-config.json` líneas 18-26.

## Qué no se hizo

No se cambió lógica de producto, corpus ni estilos. No se rehizo OCR. No se abrió Electron ni un emulador. La paridad de locales de arriba es un conteo del manifest, no una propuesta de traducción.

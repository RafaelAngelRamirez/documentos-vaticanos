# Cursor de lectura

Propuesta de estructura. No está implementada. La dirección de un lugar del libro pasa a ser un solo tipo, y la ruta guarda ese tipo.

## Problem

La cita estable del producto es `documentId` + `unitIndex` (`index_array`). Esa dirección no existe como tipo. El mismo lugar se escribe de tres maneras que no coinciden:

- La ruta `/leyendo/:id/punto/:user` guarda el `consecutivo` cuando el artículo ya está en memoria (`Gn 1,1`, `LG 16`, `27`) y, si no, el índice como texto. `LectorComponent.applyRoutePunto` lee al revés: si el segmento es un entero y `documento[n]` existe, lo usa como índice de array antes de buscar `consecutivo`. En el CIC y en la Biblia esos dos números no son el mismo lugar. El foco de `ensureWindow` sale de `NavigationService.actual_index` (localStorage), no del segmento.
- `NavigationService` persiste `document_id`, `actual_index` y `article_selected`. Este último incluye `contenido` de una unidad y los términos de búsqueda. `document_selected` además acepta el título (`nombre`) como si fuera el id.
- `ReadingProgressService` persiste otra tarjeta, `dv.lastRead`, cuando el scroll-spy ve otra unidad. Las portadas de documento, santo y papa continúan desde ahí. Padre y doctor ignoran la tarjeta y abren la unidad 0. `dv.pos.*` se escribe en cada persistencia y no tiene lector. `dv.nav` se escribe al lado y tampoco tiene lector.

Quien sigue un enlace, quien pulsa Continuar y quien vuelve de una cita pueden caer en tres unidades distintas del mismo libro. `CorpusLoadEngine.matchesMeta` agranda el hueco: `ensureWindow` acepta `id`, `title` o `shortTitle`, y la caché recuerda los tres. Dos packs con el mismo `shortTitle` comparten entrada.

El cromo por página, el RTL físico, el mínimo de Electron y el merge de cuenta son otras fronteras. No entran en esta forma.

## Usage (caller's view)

Tres llamadas reales. La puerta sigue siendo `NavigationService.openReading`. El índice ya es `UnitIndex`. El `consecutivo` no viaja.

Portada de obra (hoy `PadreDetalleComponent.openPrimaryWork` abre siempre 0; la ficha de documento calcula el índice por su cuenta). Las dos leen la misma tarjeta:

```ts
openPrimaryWork(autoNarr = false): void {
  const id = parseDocumentId(this.primaryWorkId);
  if (!id) return;
  this.navigation.openReading(id, {
    unitIndex: resumeUnitFor(this.navigation.resume(), id),
    autoNarr,
  });
}
```

Cita dentro del lector (`PuntoComponent.openRef`). `idPunto` que no sea un índice canónico no navega:

```ts
openRef(seg: ContentSegment, event?: Event): void {
  event?.preventDefault();
  event?.stopPropagation();
  if (seg.type !== 'ref' || !seg.local) return;
  const id = parseDocumentId(seg.local.idDocumento);
  const unitIndex = parseUnitIndex(seg.local.idPunto);
  if (!id || unitIndex == null) return;
  this.citationPreview.emit({ seg, documentId: this.documentId });
  this.navigation.openReading(id, { unitIndex, stack: 'push' });
}
```

Búsqueda (`BuscadorComponent.openRow`). Limpia la pila de citas y pasa solo las cadenas a resaltar. El cuerpo del artículo no se guarda:

```ts
openRow(row: SearchRow): void {
  const id = parseDocumentId(row.resultado.doc.id);
  const unitIndex = parseUnitIndex(row.punto.article.index_array);
  if (!id || unitIndex == null) return;
  this.navigation.openReading(id, {
    unitIndex,
    stack: 'clear',
    highlight: row.punto.terms_pure ?? [],
  });
}
```

Tema, estudio, notas, relacionados y admin usan la misma puerta con `unitIndex` y sin `consecutivo`. `navigateToUnit`, `pushAndGo` y `go_to_read_article` salen de la superficie.

## Shape

Un solo cursor. La URL canónica es la dirección. La tarjeta de continuar es una proyección de la unidad que el lector llegó a mostrar. Hay un escritor de la ruta y de la pila (`NavigationService`) y un solo método que mueve esa ruta mientras se lee (`noteVisible`), llamado solo por el lector.

```text
/leyendo/:documentId/u/:unitIndex
```

`documentId` es el id del pack (`cic-es`) o un id sintético ya existente (`santoral:…`, `papacy:…`). `unitIndex` es un entero en base 10, sin ceros a la izquierda salvo el `0`. `parentPathForAppUrl` ya toma el segundo segmento como documento y manda al cover; el segmento `u` no cambia esa regla.

`frontend/src/app/core/reading/cite.ts` es puro. Ahí viven el parser, los comandos de ruta, la tarjeta, la pila y la llegada legacy. `NavigationService` es el adaptador Angular: router, `localStorage` de la tarjeta, `sessionStorage` de la pila y el flag `dv.autoNarr`. `LectorComponent` pide la ventana a `CorpusService` con la cita de la ruta y reporta la unidad visible. El cuerpo sigue detrás de `CorpusService`. Quien abre un libro no mira chunks, ni `matchesMeta`, ni las claves viejas.

Llegada. El lector sigue montado en las tres rutas, para no añadir un componente de redirect:

| Ruta | Qué hace `parseArrival` |
|---|---|
| `/leyendo/:documentId/u/:unitIndex` | Cita, si ambos segmentos parsean. |
| `/leyendo/:id/punto/:user` con entero canónico | Redirect `replaceUrl` a `/u/:n`. El lector de hoy ya prefería el índice de array cuando el slot existía. |
| `/leyendo/:id/punto/:user` con cualquier otra etiqueta | Redirect a la tarjeta si es de ese documento; si no, a la unidad 0. No se escanea el libro. |
| `/leyendo/:documentId` | Igual: tarjeta de ese id, o unidad 0. |

El redirect no carga corpus. `ensureWindow` corre solo sobre la cita canónica, con el `unitIndex` de la ruta como foco.

Escritor de la ruta. `openReading` parsea, arma `['leyendo', documentIdKey(id), 'u', String(unitIndex)]` y navega. `stack: 'push'` empuja la cita actual si existe y es distinta del destino. `stack: 'clear'` vacía la pila. El default `'keep'` no la toca. La pila guarda solo `Cite`, tope 32, en `sessionStorage` `nav_stack`. `goBack` hace pop y navega a esa cita. El rótulo de «Cita anterior» no lee el frame; el campo `label` no se conserva.

`noteVisible(cite, display, generation)` es el otro escritor, y solo avanza la unidad visible:

- Si `generation` no es el de la navegación que pintó esa ventana, no escribe y no navega.
- Si el `documentId` no es el de la ruta, tampoco.
- Si el `unitIndex` cambió dentro del mismo documento, `replaceUrl` a `/u/:n` sin empujar la pila y sin subir `generation`.
- Escribe `dv.lastRead` solo después de esa comprobación.

El lector, al cambiar solo el índice dentro de la ventana ya cargada, mueve el foco. No vuelve a suscribir `ensureWindow`. Si el índice cae en un hueco, usa `ensureUnits`. La suscripción anterior se cancela al cambiar de documento. Un `next` tardío con otra `generation` o con otra cita no pinta y no llama a `noteVisible`.

La unidad visible sale de `data-unit` (`index_array`) del `app-punto` espiado. El offset `actual_inferior_limit + i` deja de ser la dirección. `display.unitCount` sale de `meta.unitCount` cuando es un entero positivo. Si falta, queda 0 y el porcentaje queda 0. La longitud del array parcial no entra en la tarjeta. `display.title` es `meta.title`. `display.label` es el `consecutivo` de esa unidad cuando existe y no es `no-encontrado`.

`CorpusService.ensureWindow(cite, radius)` sigue siendo la única carga, bios sintéticas incluidas. El motor compara `meta.id` y la caché recuerda solo ese id. Un título o un `shortTitle` no resuelve un documento.

Resaltado de búsqueda. `highlight` vive en memoria dentro de `NavigationService`, asociado a una cita. El lector lo aplica al pintar esa cita. No va a `localStorage`. Un reload lo pierde. Cambiar de cita lo tira.

Arranque, una vez. Se borran `document_id`, `article_selected` y `actual_index` sin rehidratar el cuerpo. La ruta desnuda `/leyendo/:id` aún puede leer ese par, solo si el id coincide, para elegir el redirect de esa llegada, y después borra las tres claves. `dv.lastRead` se revalida con el parser; si no es una cita, se borra la clave. Frames viejos de `nav_stack` se quedan solo cuando `actual_index` es un `UnitIndex`; el `consecutivo` del frame se ignora. Se deja de escribir `dv.nav` y `dv.pos.*`. Las claves `dv.pos.*` ya escritas se quedan huérfanas. `dv.settings` y `ReadingProgressService` salen: las preferencias vivas siguen en `reader.prefs.v1`.

Si la operación corre dos veces:

- `openReading` de la misma cita con `stack: 'keep'` no sube `generation` y no navega otra vez. El spy en curso sigue siendo válido.
- `openReading` con `stack: 'push'` hacia la cita ya abierta no empuja y no navega.
- Dos `openReading` síncronos mientras hay un destino pendiente: el segundo no hace nada. `NavigationEnd` suelta el pendiente. Así no se duplica el frame. Un segundo clic de cita durante el vuelo se pierde.
- `goBack` durante el pendiente devuelve `false` y no desapila. El segundo back, ya asentado, desapila el frame siguiente.
- `stack: 'clear'` sobre una pila vacía no escribe.
- `noteVisible` dos veces con la misma cita reescribe la tarjeta y mueve `updatedAt`. Sigue habiendo una sola clave. El lugar no cambia.
- `noteVisible` con `generation` vieja no escribe. Una carga que termina después de haber saltado de documento no mueve Continuar.
- Dos pestañas escriben la misma clave `dv.lastRead`. Gana la última unidad visible. La pila no se comparte: es `sessionStorage`.
- `parseResumeCard` de una clave rota la borra y devuelve `null`. La segunda lectura también devuelve `null`.
- `openReading` con un id que no parsea no navega, no toca la pila y no toca la tarjeta.

`Anotacion` ya guarda `documentId` y `unitIndex`. No se cambia su JSON ni el merge. Quien cree una anotación pasa un `Cite` ya parseado; el servicio sigue persistiendo los dos campos.

## Synthesis decision

Base: el candidato de grok-4.7-xhigh-fast. Es la única forma que salió de un runner. `claude-opus-5-5-max` y `gpt-5.6-sol-max` devolvieron el límite de uso de Cursor y esos asientos quedaron vacíos. No se relanzaron en otro host.

El padre escribió una segunda forma, distinta, para no sintetizar sobre un solo boceto. Esa forma pone el cromo en un solo `PagesComponent`: una tabla `chromeFor(url)` decide `wbar`, `fbar` y `bnav`, el `minWidth` de Electron sube a 1024, y las páginas dejan de montar barras. La dirección de lectura no cambia.

Gana el cursor. La tabla de cromo esconde qué barras se ven, pero cada ruta nueva edita la tabla, y un lector sigue pudiendo caer en tres unidades distintas del mismo libro. El cursor esconde la dirección (`documentId` + `unitIndex`) detrás de `openReading` y `noteVisible`. Un call site no puede volver a meter un `consecutivo` en la ruta.

Se rechazó injertar la tabla de cromo, el merge de cuenta y la unificación de `DocumentMeta` en este módulo. Son otras invariantes. El candidato ya las había dejado fuera. El padre coincide.

Cribado de banderas. El módulo `cite.ts` es profundo: muchos casos de llegada, una superficie de dos escrituras. No hay pass-through (`navigateToUnit` sale). El `consecutivo` no está en `Cite`. Las tres operaciones (abrir, mostrar, volver) protegen la misma dirección, no tres etapas con el mismo DTO.

## Tradeoffs accepted

Los enlaces viejos cuyo segmento no es un entero canónico (`/punto/Gn%201,1`, `/punto/LG%2016`, `/punto/§1`) dejan de buscarse en el cuerpo. Caen en la tarjeta de ese documento o en la unidad 0. Un enlace numérico pasa a significar `unitIndex`, que es lo que el lector ya hacía cuando el slot estaba cargado.

El reload de una búsqueda ya no restaura el resaltado ni el `contenido` que hoy viaja en `article_selected`. El resaltado dura lo que dura la pestaña y la cita.

El scroll en píxeles no se restaura. El grano de continuar es la unidad.

Padre y doctor pasan a continuar por la tarjeta, igual que la portada del documento. Si la tarjeta está en la unidad 0, se abre la 0, como ahora cuando no hay progreso.

Una cita cuyo `idPunto` es una etiqueta sigue sin navegar. Hoy `Number('LG 16')` ya se descarta.

Dos clics de cita en el mismo turno: el segundo se ignora hasta `NavigationEnd`.

`dv.pos.*` queda basura en `localStorage`. No hay barrido.

## Alternatives considered

Dejar los módulos y cambiar solo el segmento de la ruta a un entero, con `applyRoutePunto` todavía mirando `actual_index`. El fallo de hoy es que la ventana se centra en el índice guardado, no en la URL. Un segmento nuevo con dos almacenes sigue mintiendo al continuar y al deep link.

Un `ReadingSession` que absorba cromo, cuenta, temas y estrellas. Son otras invariantes (quién monta las barras; identidad de fila y last-write-wins). Meterlas en el cursor deja un módulo plano y una superficie enorme.

Mantener `navigateToUnit` como envoltura de `openReading`, aceptando `consecutivo` «por compatibilidad». Es un pass-through y la etiqueta vuelve a entrar en la dirección.

Resolver el `consecutivo` legacy contra `content.json` o `indice_por_punto` dentro del lector. Segunda dirección, y en la Biblia el consecutivo ni siquiera entra en `indice_por_punto`. El escaneo también reabre la ventana equivocada.

Partir el estado por actor (una tarjeta por pestaña, merge al leer). El producto tiene una sola fila de continuar. La pila ya es por pestaña.

Unificar las tres copias de `DocumentMeta`, el pipeline de chunks o `mapUnitIndexOnLocaleSwitch`. Otro documento es otra cita. El índice no se hereda entre locales.

Arreglar en esta forma el cromo que cada página monta, el CSS físico con `dir=rtl` y el `minWidth` 360 de Electron. Hace falta otra frontera, la del shell. Este cambio no la toca.

La forma del padre (tabla `chromeFor` dentro de `PagesComponent`, `minWidth` 1024) pierde por lo dicho en la síntesis. El CSS físico y el menú de Electron se quedan como deuda visual, no como módulo nuevo.

## Open questions and risks

No abrí un deep link en el navegador. La preferencia «entero = índice» está en `applyRoutePunto` (líneas 906–913). No conté cuántos `consecutivo` numéricos del CIC difieren de su `index_array`. Esos enlaces, si alguien los guardó, cambian de unidad.

No medí cuántos resultados de búsqueda comparten `/punto/` más una etiqueta. En una pestaña nueva, esa etiqueta ya se busca solo dentro de la ventana centrada en `actual_index`.

`replaceUrl` al desplazar tiene que no reentrar en `ensureWindow`. Si el `paramMap` rearma la carga, el spy y el router se persiguen. El corte es el de la Shape: mismo documento, ventana ya cargada, solo se mueve el foco.

`meta.unitCount` ausente deja el porcentaje en 0 hasta que el pack lo traiga. Preferible a usar `documento.length` de un array con huecos.

Ids con `:` (`santoral:`, `papacy:`) siguen siendo un solo segmento, como hoy. Si el router partiera el segmento, el parser lo rechazaría y el lector mostraría error en vez de adivinar.

## Next implementation step

Un solo cambio. Añadir `frontend/src/app/core/reading/cite.ts` con los parsers y las funciones puras de abajo, y tests de: entero canónico, `Gn 1,1` que no es índice, tarjeta rota, frame viejo con `consecutivo`, y `resumeUnitFor` en la unidad 0. En el mismo cambio, `NavigationService.openReading` emite solo `/u/:unitIndex`, el lector carga el foco desde esa cita, `matchesMeta` compara `meta.id`, y los call sites de `navigateToUnit` / `go_to_read_article` / `openPrimaryWork` pasan al uso de arriba. Las claves `document_id`, `article_selected` y `actual_index` se borran en ese arranque.

## Module map

```text
frontend/src/app/core/reading/cite.ts          nuevo, puro
frontend/src/app/services/navigation.service.ts   único escritor de ruta, pila y tarjeta
frontend/src/app/services/open-reading.logic.ts   se queda applyAutoNarrFlag
frontend/src/app/components/lector/lector.component.ts
frontend/src/app/core/corpus/corpus.service.ts
frontend/src/app/core/corpus/corpus-load.logic.ts  matchesMeta por id
frontend/src/app/pages/pages-routing.module.ts    ruta /u/:unitIndex
frontend/src/app/components/punto/punto/punto.component.ts
frontend/src/app/components/buscador/buscador.component.ts
frontend/src/app/pages/padre-detalle/padre-detalle.component.ts
frontend/src/app/pages/doctor-detalle/doctor-detalle.component.ts
frontend/src/app/pages/documento-detalle/documento-detalle.component.ts
frontend/src/app/pages/santo-detalle/santo-detalle.component.ts
frontend/src/app/pages/papa-detalle/papa-detalle.component.ts
frontend/src/app/pages/inicio/inicio.component.ts
frontend/src/app/pages/list-documents-pages/list-documents-pages.component.ts
frontend/src/app/pages/estudios/estudios.component.ts
call sites de navigateToUnit (tema, estudio, tópico, relacionados, notas, admin)

se vacían y se borran:
frontend/src/app/services/reading-progress.service.ts
frontend/src/app/services/reading-progress.logic.ts
```

`coverPathForDocumentId` y `parentPathForAppUrl` no cambian de contrato. `CorpusService` sigue desviando `santoral:` y `papacy:` antes del motor. `AnotacionesService` no cambia de clave.

## Types

```ts
/** Pack id (`cic-es`, `lg-en`) o bio sintética. No es un título. */
export type DocumentId =
  | { readonly kind: 'corpus'; readonly id: string }
  | { readonly kind: 'santoral'; readonly saintId: string }
  | { readonly kind: 'papacy'; readonly popeId: string };

/** Entero ≥ 0, forma canónica. Único constructor: parseUnitIndex. */
export type UnitIndex = number & { readonly __brand: 'UnitIndex' };

export interface Cite {
  readonly documentId: DocumentId;
  readonly unitIndex: UnitIndex;
}

export interface ResumeDisplay {
  readonly title: string;
  readonly unitCount: number;
  readonly label?: string;
}

export interface ResumeCard {
  readonly cite: Cite;
  readonly display: ResumeDisplay;
  readonly updatedAt: string;
}

export interface OpenReadingOptions {
  readonly unitIndex?: UnitIndex;
  readonly autoNarr?: boolean;
  readonly stack?: 'keep' | 'push' | 'clear';
  readonly highlight?: readonly string[];
}

export type Arrival =
  | { readonly kind: 'cite'; readonly cite: Cite }
  | { readonly kind: 'redirect'; readonly cite: Cite }
  | { readonly kind: 'invalid' };

export function parseDocumentId(raw: string | null | undefined): DocumentId | null {
  not implemented
  // decodeURIComponent si hay '%'.
  // 'santoral:' + id no vacío → { kind: 'santoral' }.
  // 'papacy:' + id no vacío → { kind: 'papacy' }.
  // slug [a-z0-9][a-z0-9-]* → { kind: 'corpus' }.
  // título, shortTitle, vacío, espacios → null.
}

export function documentIdKey(id: DocumentId): string {
  not implemented
  // corpus → id; santoral → `santoral:${saintId}`; papacy → `papacy:${popeId}`.
}

export function parseUnitIndex(raw: number | string | null | undefined): UnitIndex | null {
  not implemented
  // number: entero finito, ≥ 0, <= Number.MAX_SAFE_INTEGER.
  // string: /^(0|[1-9][0-9]*)$/ y el mismo tope.
  // '27.0', '027', 'Gn 1,1', 'LG 16', '' → null.
}

export function cite(documentId: DocumentId, unitIndex: UnitIndex): Cite {
  not implemented
}

export function sameCite(a: Cite | null | undefined, b: Cite | null | undefined): boolean {
  not implemented
}

export function readingCommands(cite: Cite): string[] {
  not implemented
  // ['leyendo', documentIdKey(cite.documentId), 'u', String(cite.unitIndex)]
}

export function resumeUnitFor(card: ResumeCard | null, documentId: DocumentId): UnitIndex {
  not implemented
  // misma obra y unitIndex > 0 → ese índice; si no → 0.
}

export function parseResumeCard(raw: string | null): ResumeCard | null {
  not implemented
  // JSON con documentId + unitIndex válidos. Si no, null.
  // title string; unitCount entero ≥ 0 o 0; label string opcional.
}

export function serializeResumeCard(card: ResumeCard): string {
  not implemented
}

export function pushCite(stack: readonly Cite[], frame: Cite): Cite[] {
  not implemented
  // tope 32. No duplica si el tope ya es sameCite(frame).
}

export function parseStack(raw: string | null): Cite[] {
  not implemented
  // array de Cite, o frames viejos { documentId, actual_index } con índice válido.
  // consecutivo del frame se ignora. Basura → [].
}

export function parseArrival(input: {
  documentId: string | null;
  unit: string | null;
  legacyUser: string | null;
  resume: ResumeCard | null;
}): Arrival {
  not implemented
  // unit presente → cite o invalid.
  // legacyUser entero canónico → redirect a esa unidad.
  // legacyUser de otro tipo, o ruta desnuda → redirect a resumeUnitFor.
}

export class NavigationService {
  readonly generation: number; // sube solo cuando la cita de la ruta cambia

  openReading(documentId: DocumentId, options?: OpenReadingOptions): void {
    not implemented
    // destino = cite(documentId, options.unitIndex ?? 0).
    // pendiente sameCite → return.
    // stack push: empuja routeCite si es distinta.
    // stack clear: pila = [].
    // misma cita y stack keep → no sube generation; sustituye highlight.
    // navega a readingCommands. autoNarr escribe dv.autoNarr como hoy.
    // highlight queda en memoria para esa cita.
  }

  goBack(): boolean {
    not implemented
    // pendiente → false. pop y openReading(frame, { stack: 'keep' }).
  }

  canGoBack(): boolean {
    not implemented
  }

  resume(): ResumeCard | null {
    not implemented
    // lee dv.lastRead. null si el parser falla (y borra la clave).
  }

  highlightFor(cite: Cite): readonly string[] | null {
    not implemented
  }

  noteVisible(cite: Cite, display: ResumeDisplay, generation: number): void {
    not implemented
    // generation distinta o documentId distinto → return.
    // unitIndex distinto → replaceUrl a readingCommands, sin push, sin subir generation.
    // escribe dv.lastRead con updatedAt nuevo.
  }

  replaceWith(cite: Cite): void {
    not implemented
    // replaceUrl. No toca la pila. Lo usa el redirect de parseArrival.
  }
}

export class CorpusService {
  ensureWindow(cite: Cite, radius: number): Observable<LoadedDocument> {
    not implemented
    // kind santoral | papacy → ensureLoaded del id sintético, como hoy.
    // kind corpus → engine.ensureWindow(documentIdKey, cite.unitIndex, radius).
  }
}

// corpus-load.logic.ts
private matchesMeta(meta: DocumentMeta, id: string): boolean {
  not implemented
  // meta.id === id
}

private remember(loaded: LoadedDocument): void {
  not implemented
  // cache.set(loaded.meta.id, loaded) solamente.
}
```

`LectorComponent.loadCite` (pseudocódigo, un solo lugar):

```ts
loadCite(cite: Cite, generation: number): void {
  if (this.loadedId && sameDocument(this.loadedId, cite.documentId)) {
    this.focusUnit(cite.unitIndex); // ensureUnits si hay hueco; no re-suscribe
    return;
  }
  this.loadSub?.unsubscribe();
  this.loadSub = this.corpus.ensureWindow(cite, RADIUS).subscribe(loaded => {
    if (this.navigation.generation !== generation) return;
    if (!sameCite(this.navigation.routeCite, cite)) return;
    this.document = loaded;
    this.focusUnit(cite.unitIndex);
    const article = loaded.documento[cite.unitIndex];
    if (!article || article.index_array !== cite.unitIndex) return;
    this.navigation.noteVisible(cite, displayFrom(loaded.meta, article), generation);
  });
}
```

El spy de scroll llama a `noteVisible` con la `generation` capturada al pintar y con el `Cite` de `data-unit`.

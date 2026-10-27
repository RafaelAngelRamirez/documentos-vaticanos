---
name: n8n-documentos-vaticanos
description: >-
  Documenta el flujo n8n «Documentos Vaticanos build» (id
  DocumentosVaticanosBuild en
  https://nochon.codice-progressio.online/): espera a Imperium y no toma el
  candado. Úsala al pedir n8n, nochon, la cola o el candado del build. No
  edita el flujo ni el servidor.
---

# Documentos Vaticanos build

Esta skill solo documenta el flujo actual. No lo edites. No reimportes JSON. No toques Imperium, Cloudflare ni el servidor.

## Flujo

| | |
|--|--|
| Nombre | Documentos Vaticanos build |
| Id | `DocumentosVaticanosBuild` |
| Sitio | https://nochon.codice-progressio.online/ |
| Ramas | push a `master` o `typescript-migration` en `RafaelAngelRamirez/documentos-vaticanos` |
| Webhook manual | `POST /webhook/documentos-vaticanos-build` |
| Hook de GitHub | `703012858` |

Espera a Imperium y no toma el candado.

En **Cola: acquire** espera mientras haya `holder` o la cola tenga `imperium`, `imperium-aab`, `imperium-win` o `imperium-linux`. Cuando eso está libre, entra. No escribe `holder=docvat` y no se encola.

**Cola: release** no escribe el estado compartido y devuelve `nudge_other: false`. Este flujo no tiene el nodo de despertar a Imperium.

El candado compartido sigue en `/tmp/codice-ci-global-build.json`, con cerrojo `/tmp/codice-ci-global-build.lock`. Lo usa Imperium. Documentos Vaticanos no lo toma. Mientras este flujo compila, Imperium puede entrar: en esa ventana comparten CPU y disco.

El sidecar no hace `acquire` como `play`. Si queda un ticket de Play, está en `/tmp/codice-ci-pending-docvat-play.json`.

La entrada del build es `.ci-build.sh`. El empaquetado local está en `build-documentos-vaticanos`. El corte de versión está en `release-documentos-vaticanos`.

## Lo que no está publicado

`DOCVAT-build v1 (sidecar)` (`DOCVATBuildV1sc`) está inactivo. No se borró. Su webhook `POST /webhook/docvat-build` no está registrado. `deploy/DOCVAT-build-v1-sidecar.json` y la sección de n8n en `deploy/README.md` describen ese flujo compartido: toma el candado y puede despertar a Imperium. No los uses para operar el flujo actual. No los reimportes.

`IMPERIUM-build v2 (sidecar)` (`IMPERIUMbuildV2sc`) queda fuera de esta skill. No lo edites.

El id `DocumentosVaticanosBuild` mide 23 caracteres. n8n no persiste el dato estático del nodo si el id pasa de 21, así que el número del hook (`703012858`) está anotado en el flujo para que un reinicio reconozca el hook ya creado y no registre otro.

## Qué hace un agente

1. Un push a `master` o `typescript-migration` ya arranca este flujo. No lances otro mientras uno sigue: no toma el candado, así que el segundo no espera al primero.
2. No hagas POST al webhook salvo que te lo pidan. Ese POST arranca el build de producción.
3. No cambies el flujo, el candado ni Cloudflare.

---
name: verify-documentos-vaticanos-android
description: "No usada y fuera del gate (PR #66). El emulador Android no es la prueba móvil. La prueba canónica es verify-documentos-vaticanos-viewport (node scripts/dv-verify-viewport.mjs, drive lector y drive biblioteca). Estos archivos se conservan."
---

# Verify Android

Fuera del gate y no usada. La prueba móvil canónica es `verify-documentos-vaticanos-viewport` (`node scripts/dv-verify-viewport.mjs`, `drive lector` y `drive biblioteca`). Los archivos de esta skill se conservan.

La superficie descrita abajo es el emulador Android del lector Capacitor (`digital.documentosvaticanos.app`). No publica en Play.

Launch, doctor, drive y cleanup viven en `scripts/dv-verify-android.mjs`. El mapa de rutas de la web sigue en `.cursor/skills/verify-documentos-vaticanos/features/`. Esta skill no lo copia. La prueba de lector es la misma puerta: `/leyendo/cic-es/punto/2`, que `readingCommands` reescribe a `/leyendo/cic-es/u/2`.

Prioriza el patrón canónico documentado sobre el código existente con deuda. El patrón canónico de esta superficie es un solo AVD de esta skill, sin `-wipe-data`, y el drive lee el WebView de depuración. Si la verificación falla por deuda técnica, reporta el patrón malo y propón la corrección hacia arriba en la pirámide (arquitectura, luego análisis estático, luego instrucción).

## Qué no hace

No descarga la imagen de sistema, no instala el SDK, no cambia el modo de `/dev/kvm`, no hace `sudo` y no crea el AVD si una compuerta falla. No usa `-wipe-data`. No arranca en los puertos 5564 ni 5580. No empaqueta el APK: eso es `yarn package:apk`. No toca keystores ni Play.

## Compuertas del launch

Antes de crear un AVD o de arrancar el proceso, el script exige todo esto:

- `/dev/kvm` se abre en lectura y escritura por el usuario actual. Si el dispositivo no está, la línea es `launch fail kvm missing`. Si está y el usuario no puede abrirlo, `launch fail kvm permission`.
- Memoria disponible de al menos 2800 MB (`MemAvailable`).
- Al menos 8 GB libres en el disco del directorio de AVDs.
- `emulator` y `adb` bajo `ANDROID_HOME`, `ANDROID_SDK_ROOT` o `~/Android/Sdk`.
- Para crear el AVD, la imagen ya instalada `system-images;android-34;default;x86_64` y `cmdline-tools/latest/bin/avdmanager`. Si la imagen no está, `launch fail image`.

El puerto por defecto es 5574 (`DV_VERIFY_ANDROID_PORT`). El AVD por defecto es `dv_verify` (`DV_VERIFY_ANDROID_AVD`). Al crearlo usa el perfil `medium_phone`, 1536 MB de RAM y partición de datos de 2048M. Un AVD que ya existe no se reescribe y no se borra.

En esta nube `/dev/kvm` existe con modo `660` y grupo numérico 103, y el usuario del agente no pertenece a ese grupo. El script no lo arregla. Con el dispositivo escribible, `emulator -accel-check` responde que KVM es usable y el primer arranque de `dv_verify` llegó a `sys.boot_completed` 1.

## Launch

Desde la raíz del repo:

```bash
node scripts/dv-verify-android.mjs launch
```

Ready cuando stdout contiene `launch ready` y `doctor ok`. El estado queda en `.cursor/skills/verify-documentos-vaticanos-android/.run/state.json`. La espera por defecto es 180 s (`DV_VERIFY_ANDROID_WAIT_MS`).

Si `emulator-5574` ya arrancó, o el pid propio sigue vivo, o el puerto de consola ya escucha, el launch espera ese proceso (`launch reuse` si es propio, `launch adopted` si no). No abre un segundo emulador en el mismo puerto. Cleanup no mata un emulador adoptado.

Un timeout escribe `evidence/launch.txt`. Si el proceso es propio, manda `SIGTERM` al grupo y `adb emu kill`, y sale distinto de cero.

El proceso usa `-no-window`, `-no-audio`, `-no-boot-anim`, `-gpu swiftshader_indirect`, `-accel on`, `-memory 1536` y `-no-metrics`.

## Doctor

```bash
node scripts/dv-verify-android.mjs doctor
```

Chequeo de solo lectura: el serial del estado responde `sys.boot_completed` 1 y, si el launch es propio, el pid sigue vivo. Stdout `doctor ok` es el pase.

## Drive

```bash
node scripts/dv-verify-android.mjs drive lector
```

Hace falta el emulador del launch y un APK de depuración ya construido. Lo busca en `DV_VERIFY_ANDROID_APK`, en `dist/documentos-vaticanos-debug.apk` y en `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Si la app no está instalada y no hay APK, sale `drive fail apk` y no lo construye.

Instala con `adb install -r` solo si falta el paquete, o si `DV_VERIFY_ANDROID_REINSTALL=1`. Arranca `digital.documentosvaticanos.app/.MainActivity`. El WebView de un APK de depuración expone `webview_devtools_remote_<pid>`. El script reenvía ese socket a `127.0.0.1:9222` (`DV_VERIFY_ANDROID_CDP_PORT`) y, por el protocolo de depuración, escribe `reader.prefs.v1` con `uiLocale` y `contentLocale` en `es` y abre el lector.

- Acción. `am start` de la actividad y navegación a `https://localhost/leyendo/cic-es/punto/2`.
- Resultado. La URL contiene `/leyendo/cic-es/u/2`. `app-lector` está en el DOM. `app-punto` es visible. `.bnav` cuenta 0.

`drive` con otro id sale distinto de cero. No hay viewport de escritorio de respaldo.

## Evidence

`launch` escribe `.cursor/skills/verify-documentos-vaticanos-android/evidence/launch.txt`.

`drive lector` escribe `.cursor/skills/verify-documentos-vaticanos-android/evidence/lector.txt` con la acción, la URL resultante, los selectores y un extracto. Eso es la prueba. Sobrevive al cleanup.

## Cleanup

```bash
node scripts/dv-verify-android.mjs cleanup
```

Si el launch es propio, manda `SIGTERM` a ese pid y `adb emu kill` a ese serial. Quita el `adb forward` del puerto de depuración. Borra `.run/`. No borra el AVD, no borra la imagen y no borra `evidence/`. Un emulador adoptado no se apaga.

## Helpers

```bash
node scripts/dv-verify-android.mjs launch
node scripts/dv-verify-android.mjs doctor
node scripts/dv-verify-android.mjs drive lector
node scripts/dv-verify-android.mjs cleanup
```

Sin subcomando imprime `usage: dv-verify-android.mjs launch|doctor|drive <lector>|cleanup` y sale 2.

Las compuertas y el juicio del lector se prueban sin emulador:

```bash
node --test scripts/dv-verify-android.test.mjs
```

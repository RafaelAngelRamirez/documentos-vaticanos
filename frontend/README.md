# Documentos Vaticanos

Angular 16 PWA with Capacitor 5 for Android.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.0.3 (upgraded to Angular 16).

## Development server

Run `ng serve` (or `npm start`) for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Build (web)

```bash
npm run build
```

Artifacts go to `dist/documentos-vaticanos/`.

## Android (Capacitor 5)

Requirements: [Android Studio](https://developer.android.com/studio) with Android SDK, JDK 17 recommended.

```bash
# Production web build + copy into native project
npm run build:cap

# Or step by step:
npm run build
npx cap sync

# Open in Android Studio (after android/ platform exists)
npm run cap:android
```

First-time platform setup (if `android/` is missing):

```bash
npm run build
npx cap add android
npx cap sync
npm run cap:android
```

Then in Android Studio: wait for Gradle sync, pick a device/emulator, and Run.

### Notes

- `appId`: `digital.documentosvaticanos.app`
- Web assets: `dist/documentos-vaticanos` (`webDir` in `capacitor.config.ts`)
- Service worker is **disabled on native** (`Capacitor.isNativePlatform()`); it still runs for the web PWA.
- Do not commit `android/local.properties` or other machine-specific Android files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

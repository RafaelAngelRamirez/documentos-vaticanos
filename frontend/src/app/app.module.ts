import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Capacitor } from '@capacitor/core';
import { AuthInterceptor } from './core/auth/auth.interceptor';

/** Electron shell (preload flag or userAgent) — SW optional; native/Capacitor skip. */
function isElectronShell(): boolean {
  if (typeof window !== 'undefined') {
    const shell = (window as Window & {
      documentosVaticanosShell?: { kind?: string };
    }).documentosVaticanosShell;
    if (shell?.kind === 'electron') {
      return true;
    }
  }
  return (
    typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
  );
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      // Disable on Capacitor native and Electron shell (offline pack is the app itself)
      enabled:
        environment.production &&
        !Capacitor.isNativePlatform() &&
        !isElectronShell(),
      // Register the ServiceWorker as soon as the app is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),
    BrowserAnimationsModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

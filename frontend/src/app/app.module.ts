import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { DailyNotificationsService } from './core/notifications/daily-notifications.service';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Capacitor } from '@capacitor/core';
import { AuthInterceptor } from './core/auth/auth.interceptor';
import { detectElectronShell } from './core/shell/shell.util';

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
        !detectElectronShell(),
      // Register the ServiceWorker as soon as the app is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),
    BrowserAnimationsModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [DailyNotificationsService],
      useFactory: (daily: DailyNotificationsService) => () => {
        daily.init();
      },
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

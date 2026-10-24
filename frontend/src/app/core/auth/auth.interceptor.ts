import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const token = this.auth.accessToken;
    const api = environment.apiBaseUrl;
    if (!token || !api || !req.url.startsWith(api)) {
      return next.handle(req);
    }
    return next.handle(
      req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    );
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/core/auth/auth.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
import { SyncService } from 'src/app/services/sync.service';
import { environment } from 'src/environments/environment';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';

/** Vistas de autenticación: 1B acceso, 3B crear cuenta, 3C recuperar. */
type AuthView = 'login' | 'registro' | 'recuperar';

@Component({
  standalone: true,
  selector: 'app-cuenta',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AppFbarComponent,
    WbarComponent,
  ],
  templateUrl: './cuenta.component.html',
  styleUrls: ['./cuenta.component.css'],
})
export class CuentaComponent implements OnInit, OnDestroy {
  error: string | null = null;
  loading = false;
  apiEnabled = environment.apiBaseUrl;
  devAuth = environment.devAuthBypass;

  view: AuthView = 'login';

  /** 3C: mostrar la tarjeta «Enlace enviado». */
  sent = false;

  /** Tick so labels re-resolve when UI locale changes. */
  localeTick = 0;
  private sub = new Subscription();

  form = new FormGroup({
    email: new FormControl('dev@local.test', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    name: new FormControl('Usuario Dev', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
  });

  constructor(
    public auth: AuthService,
    private router: Router,
    private sync: SyncService,
    public i18n: UiI18nService,
  ) {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn) {
      this.auth.refreshMe().subscribe();
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  t(key: string, params?: Record<string, string | number>): string {
    void this.localeTick;
    return this.i18n.t(key, params);
  }

  switchView(view: AuthView): void {
    this.view = view;
    this.error = null;
    this.sent = false;
  }

  loginDev(): void {
    if (!this.form.valid) return;
    this.loading = true;
    this.error = null;
    const { email, name } = this.form.getRawValue();
    // Password field is visual (1B); DEV_AUTH_BYPASS ignores it.
    this.auth.loginDev(email, name).subscribe({
      next: () => {
        this.loading = false;
        // F9: respaldo local→nube en segundo plano (best-effort, no bloquea).
        void this.sync.mergeAlIniciarSesion();
        this.router.navigate(['/estudio']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error de login';
      },
    });
  }

  /** 3B · Crear cuenta (dev-auth crea el usuario con nombre + correo). */
  registrar(): void {
    const { email, name } = this.form.getRawValue();
    if (this.form.controls.email.invalid) {
      this.error = 'Ingrese un correo válido.';
      return;
    }
    if (!name.trim()) {
      this.error = 'Ingrese su nombre.';
      return;
    }
    if (!(this.devAuth && this.apiEnabled)) {
      this.error =
        'El registro con contraseña llegará con Google Auth real. Use “Continuar con Google” o login dev.';
      return;
    }
    this.loading = true;
    this.error = null;
    this.auth.loginDev(email, name).subscribe({
      next: () => {
        this.loading = false;
        // F9: registro = respaldo en nube (best-effort, no bloquea).
        void this.sync.mergeAlIniciarSesion();
        this.router.navigate(['/estudio']);
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.error || err?.message || 'Error al crear la cuenta';
      },
    });
  }

  /** 3C · Recuperar contraseña. */
  recuperar(): void {
    if (this.form.controls.email.invalid) {
      this.error = 'Ingrese un correo válido.';
      return;
    }
    this.error = null;
    this.sent = true;
  }

  loginGoogleHint(): void {
    this.error =
      'Configure environment.googleClientId y Google Identity Services, o use el acceso con correo (dev).';
  }

  upgrade(): void {
    this.loading = true;
    this.error = null;
    this.auth.upgradeToTeacher().subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.error || err?.message || 'No se pudo actualizar el rol';
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }

  goRefs(): void {
    this.router.navigate(['/cuenta/referencias']);
  }

  goThemes(): void {
    this.router.navigate(['/cuenta/temas']);
  }
}

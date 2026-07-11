import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
import { environment } from 'src/environments/environment';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';

@Component({
  standalone: true,
  selector: 'app-cuenta',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AppFbarComponent],
  templateUrl: './cuenta.component.html',
  styleUrls: ['./cuenta.component.css'],
})
export class CuentaComponent implements OnInit {
  error: string | null = null;
  loading = false;
  apiEnabled = environment.apiBaseUrl;
  devAuth = environment.devAuthBypass;

  form = new FormGroup({
    email: new FormControl('dev@local.test', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    name: new FormControl('Usuario Dev', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
  });

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn) {
      this.auth.refreshMe().subscribe();
    }
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
        this.router.navigate(['/estudio']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error de login';
      },
    });
  }

  loginGoogleHint(): void {
    this.error =
      'Configure environment.googleClientId y Google Identity Services, o use el acceso con correo (dev).';
  }

  hintSoon(kind: string): void {
    this.error =
      kind === 'registro'
        ? 'El registro con contraseña llegará con Google Auth real. Use “Continuar con Google” o login dev.'
        : 'La recuperación de contraseña no está disponible en esta versión. Use login dev o Google.';
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

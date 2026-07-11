import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';
import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  selector: 'app-cuenta',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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
    this.auth.loginDev(email, name).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error de login';
      },
    });
  }

  /** Placeholder until Google GIS script is configured with client id. */
  loginGoogleHint(): void {
    this.error =
      'Configura environment.googleClientId y el script de Google Identity Services, o usa login dev.';
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
        this.error = err?.error?.error || err?.message || 'No se pudo actualizar el rol';
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

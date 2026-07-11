import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Theme, ThemesService } from 'src/app/core/account/themes.service';
import { AuthService } from 'src/app/core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-mis-temas',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './mis-temas.component.html',
  styleUrls: ['./mis-temas.component.css'],
})
export class MisTemasComponent implements OnInit {
  items: Theme[] = [];
  loading = false;
  error: string | null = null;

  form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    description: new FormControl('', { nonNullable: true }),
  });

  constructor(
    public auth: AuthService,
    private themes: ThemesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/cuenta']);
      return;
    }
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.themes.list().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error';
      },
    });
  }

  create(): void {
    if (!this.form.valid) return;
    const { title, description } = this.form.getRawValue();
    this.themes
      .create({ title, description: description || undefined })
      .subscribe({
        next: (t) => {
          this.form.reset({ title: '', description: '' });
          this.router.navigate(['/cuenta/temas', t.id]);
        },
        error: (err) => {
          this.error = err?.error?.error || err?.message || 'No se pudo crear';
        },
      });
  }

  open(t: Theme): void {
    this.router.navigate(['/cuenta/temas', t.id]);
  }

  remove(t: Theme, ev: Event): void {
    ev.stopPropagation();
    this.themes.remove(t.id).subscribe({
      next: () => this.reload(),
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'No se pudo borrar';
      },
    });
  }
}

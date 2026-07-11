import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import {
  PersonalReference,
  ReferencesService,
} from 'src/app/core/account/references.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-mis-referencias',
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-referencias.component.html',
  styleUrls: ['./mis-referencias.component.css'],
})
export class MisReferenciasComponent implements OnInit {
  items: PersonalReference[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    public auth: AuthService,
    private refs: ReferencesService,
    private nav: NavigationService,
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
    this.error = null;
    this.refs.list().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Error al cargar';
      },
    });
  }

  open(item: PersonalReference): void {
    this.nav.navigateToUnit(item.documentId, item.unitIndex, {
      label: item.unitLabel ?? undefined,
    });
  }

  remove(item: PersonalReference): void {
    this.refs.remove(item.id).subscribe({
      next: () => this.reload(),
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'No se pudo borrar';
      },
    });
  }
}

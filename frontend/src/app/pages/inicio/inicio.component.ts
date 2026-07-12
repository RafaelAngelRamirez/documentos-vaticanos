import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NavigationService } from 'src/app/services/navigation.service';

/** Pantalla 3A · Bienvenida. */
@Component({
  standalone: true,
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
  imports: [CommonModule],
})
export class InicioComponent {
  constructor(
    private navigation: NavigationService,
    private router: Router
  ) {}

  goDocuments(): void {
    this.navigation.go_to_documents();
  }

  goCuenta(): void {
    this.router.navigate(['/cuenta']);
  }
}

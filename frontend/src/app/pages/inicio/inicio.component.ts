import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
  imports: [CommonModule],
})
export class InicioComponent {
  constructor(private navigation: NavigationService) {}

  goDocuments(): void {
    this.navigation.go_to_documents();
  }
}

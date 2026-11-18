import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CitedVerse } from 'src/app/core/liturgia/bible-cite.logic';

/**
 * The verses a lectionary citation names, and no others.
 * Lectio and lecturas del día share this list.
 */
@Component({
  standalone: true,
  selector: 'app-pasaje',
  imports: [CommonModule],
  templateUrl: './pasaje.component.html',
  styleUrls: ['./pasaje.component.css'],
})
export class PasajeComponent {
  @Input() verses: readonly CitedVerse[] = [];
  @Input() label = '';

  trackVerse(_index: number, verse: CitedVerse): string {
    return `${verse.chapter}:${verse.verse}`;
  }
}

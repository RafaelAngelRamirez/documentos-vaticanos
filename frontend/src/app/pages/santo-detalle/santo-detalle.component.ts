import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';

/** Detalle de un santo: bio + obras del corpus → /documento/:id */
@Component({
  standalone: true,
  selector: 'app-santo-detalle',
  imports: [CommonModule, RouterModule, WbarComponent],
  templateUrl: './santo-detalle.component.html',
  styleUrls: ['./santo-detalle.component.css'],
})
export class SantoDetalleComponent implements OnInit {
  saint: SaintRecord | null = null;
  works: { documentId: string; title: string }[] = [];
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private santoral: SantoralService,
    private corpus: CorpusService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.corpus.loadManifest().subscribe({
      next: () => {
        this.santoral.loadManifest().subscribe({
          next: () => {
            this.saint = this.santoral.getSaint(id) || null;
            if (!this.saint) {
              this.router.navigate(['/santoral']);
              return;
            }
            this.works = this.santoral.worksForSaint(this.saint);
            this.loading = false;
          },
          error: () => {
            this.router.navigate(['/santoral']);
          },
        });
      },
      error: () => this.router.navigate(['/santoral']),
    });
  }

  get title(): string {
    return this.saint?.displayName || this.saint?.name || '';
  }

  get kindLine(): string {
    if (!this.saint) return '';
    const parts = [this.saint.eraLabel || this.saint.era, this.saint.years].filter(
      Boolean,
    );
    return parts.join(' · ');
  }

  openDoc(documentId: string): void {
    this.router.navigate(['/documento', documentId]);
  }
}

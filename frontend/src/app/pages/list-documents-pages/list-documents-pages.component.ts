import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { CorpusService } from 'src/app/core/corpus/corpus.service';
import {
  catalogDisplayFor,
  catalogMetaLine,
} from 'src/app/core/corpus/catalog.display';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';

/** Orden preferente de pestañas (solo se muestran las presentes). */
const TAB_ORDER = [
  'Concilios',
  'Encíclicas',
  'Catecismo',
  'Escritura',
  'Padres',
  'Otros',
];

const TAB_BY_TIPO: Record<string, string> = {
  'Concilio Vaticano II': 'Concilios',
  Encíclica: 'Encíclicas',
  Exhortación: 'Encíclicas',
  Catecismo: 'Catecismo',
  'Sagrada Escritura': 'Escritura',
  'Padres de la Iglesia': 'Padres',
};

/** Pantalla 3D · Biblioteca. */
@Component({
  standalone: true,
  selector: 'app-list-documents-pages',
  imports: [CommonModule, AppFbarComponent, BnavComponent, WbarComponent],
  templateUrl: './list-documents-pages.component.html',
  styleUrls: ['./list-documents-pages.component.css'],
})
export class ListDocumentsPagesComponent implements OnInit, OnDestroy {
  query = '';
  activeTab = 'Todos';
  loading = false;
  load_error: string | null = null;

  private sub = new Subscription();

  constructor(
    public docService: CargarDocumentosJsonService,
    private router: Router,
    private corpus: CorpusService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.sub.add(
      this.docService.ensureAllLoaded().subscribe({
        next: () => {
          this.loading = false;
          this.load_error = null;
        },
        error: (err) => {
          this.loading = false;
          this.load_error =
            err?.message ?? 'No se pudieron cargar los documentos.';
        },
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get tabs(): string[] {
    const present = new Set<string>();
    for (const item of this.docService.documentos_disponibles || []) {
      present.add(this.tabOf(item));
    }
    return ['Todos', ...TAB_ORDER.filter((t) => present.has(t))];
  }

  get filtered(): IndiceDocumentos[] {
    const all = this.docService.documentos_disponibles || [];
    const q = this.query.trim().toLowerCase();
    return all.filter((item) => {
      if (this.activeTab !== 'Todos' && this.tabOf(item) !== this.activeTab) {
        return false;
      }
      if (!q) return true;
      const title = this.displayTitle(item).toLowerCase();
      const meta = this.metaLine(item).toLowerCase();
      const short = (item.shortTitle || '').toLowerCase();
      return title.includes(q) || meta.includes(q) || short.includes(q);
    });
  }

  get sinResultados(): boolean {
    return (
      !this.loading &&
      !this.load_error &&
      (this.docService.documentos_disponibles?.length || 0) > 0 &&
      this.filtered.length === 0
    );
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  onQuery(ev: Event): void {
    this.query = (ev.target as HTMLInputElement).value;
  }

  displayTitle(item: IndiceDocumentos): string {
    return (
      item.title ||
      item.nombre ||
      this.corpus.getMeta(item.id || '')?.title ||
      item.id ||
      'Documento'
    );
  }

  metaLine(item: IndiceDocumentos): string {
    const meta = this.corpus.getMeta(item.id || '');
    return catalogMetaLine(catalogDisplayFor(item.id, meta?.kind));
  }

  /** Flujo del diseño: Biblioteca → Detalle (2A), no directo al lector. */
  open(item: IndiceDocumentos): void {
    this.router.navigate(['/documento', item.id ?? item.nombre]);
  }

  private tabOf(item: IndiceDocumentos): string {
    const meta = this.corpus.getMeta(item.id || '');
    const tipo = catalogDisplayFor(item.id, meta?.kind).tipo;
    return TAB_BY_TIPO[tipo] || 'Otros';
  }
}

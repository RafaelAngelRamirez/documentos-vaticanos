import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CatalogKind,
  displayTitle,
  kindFromName,
  kindLabel,
  localeLabel,
  provenanceBadge,
} from 'src/app/core/corpus/catalog.display';
import { t } from 'src/app/core/i18n/ui-strings';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NarratorService } from 'src/app/services/narrator.service';
import { NavigationService, ROUTE } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-documento-detalle',
  imports: [CommonModule],
  templateUrl: './documento-detalle.component.html',
})
export class DocumentoDetalleComponent implements OnInit {
  doc: IndiceDocumentos | undefined;
  error: string | null = null;
  loading = true;
  kind: CatalogKind = 'other';
  t = t;

  constructor(
    private route: ActivatedRoute,
    private docs: CargarDocumentosJsonService,
    private nav: NavigationService,
    private narrator: NarratorService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const nombre = p.get('id') || '';
      this.doc = this.docs.documentos_disponibles.find((d) => d.nombre === nombre);
      this.loading = false;
      if (!this.doc) {
        this.error = 'Documento no encontrado';
        return;
      }
      this.kind = kindFromName(this.doc.nombre, this.doc.kind);
      this.nav.document_selected = this.doc;
    });
  }

  get title(): string {
    return displayTitle({ title: this.doc?.title, nombre: this.doc?.nombre });
  }
  get kindLine(): string {
    return kindLabel(this.kind);
  }
  get unitCount(): number {
    return this.doc?.documento.length ?? 0;
  }
  get localeLine(): string {
    return localeLabel(this.doc?.locale || 'es');
  }
  get badge(): string | null {
    return provenanceBadge({
      locale: this.doc?.locale,
      translationProvenance: this.doc?.translationProvenance,
    });
  }
  get sourceNote(): string | undefined {
    return this.doc?.sourceNote;
  }
  get sourceUrl(): string | undefined {
    return this.doc?.sourceUrl;
  }

  start(): void {
    if (!this.doc) return;
    void this.narrator.cancel();
    this.nav.openReading(this.doc);
  }

  listen(): void {
    if (!this.doc) return;
    void this.narrator.cancel();
    this.nav.openReading(this.doc, { autoNarr: true });
  }

  back(): void {
    this.router.navigate(['/', ...ROUTE.list_documents.split('/')]);
  }
}

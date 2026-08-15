import { Component } from '@angular/core';
import {
  CatalogKind,
  CatalogTab,
  displayTitle,
  filterByTab,
  kindFromName,
  kindLabel,
  liveTabs,
  provenanceBadge,
} from 'src/app/core/corpus/catalog.display';
import { t } from 'src/app/core/i18n/ui-strings';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NavigationService } from 'src/app/services/navigation.service';

interface CatalogRow {
  doc: IndiceDocumentos;
  kind: CatalogKind;
  title: string;
  badge: string | null;
  kindLine: string;
}

@Component({
  selector: 'app-list-documents-pages',
  templateUrl: './list-documents-pages.component.html',
  styleUrls: ['./list-documents-pages.component.css'],
})
export class ListDocumentsPagesComponent {
  t = t;
  activeTab: CatalogTab = 'Todos';

  constructor(
    public docService: CargarDocumentosJsonService,
    public navigationService: NavigationService
  ) {}

  get rows(): CatalogRow[] {
    return this.docService.documentos_disponibles.map((doc) => {
      const kind = kindFromName(doc.nombre, doc.kind);
      return {
        doc,
        kind,
        title: displayTitle({ title: doc.title, nombre: doc.nombre }),
        badge: provenanceBadge({
          locale: doc.locale,
          translationProvenance: doc.translationProvenance,
        }),
        kindLine: kindLabel(kind),
      };
    });
  }

  get tabs(): CatalogTab[] {
    return liveTabs(this.rows);
  }

  get filtered(): CatalogRow[] {
    return filterByTab(this.rows, this.activeTab);
  }

  get emptyCatalog(): boolean {
    return this.docService.documentos_disponibles.length === 0;
  }

  setTab(tab: CatalogTab): void {
    this.activeTab = tab;
  }

  openCover(row: CatalogRow): void {
    this.navigationService.document_selected = row.doc;
    this.navigationService.goToCover(row.doc.nombre);
  }

  continueLast(): void {
    const doc = this.navigationService.document_selected;
    if (!doc) return;
    this.navigationService.openReading(doc, {
      unitIndex: this.navigationService.actual_index,
    });
  }

  get lastReadLabel(): string | null {
    const doc = this.navigationService.document_selected;
    if (!doc) return null;
    return displayTitle({ title: doc.title, nombre: doc.nombre });
  }
}

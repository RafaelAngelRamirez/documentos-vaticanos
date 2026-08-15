import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription, debounceTime } from 'rxjs';
import { BuscadorComponent } from 'src/app/components/buscador/buscador.component';
import { BuscadorService } from 'src/app/components/buscador/buscador.service';
import {
  displayTitle,
  kindFromName,
  kindLabel,
} from 'src/app/core/corpus/catalog.display';
import { t } from 'src/app/core/i18n/ui-strings';
import {
  CargarDocumentosJsonService,
  IndiceDocumentos,
} from 'src/app/services/cargar-documentos-json.service';
import { NarratorService } from 'src/app/services/narrator.service';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
  imports: [CommonModule, BuscadorComponent, ReactiveFormsModule],
})
export class InicioComponent implements OnInit, OnDestroy {
  t = t;
  search = new FormControl('');
  private sub = new Subscription();

  constructor(
    public buscadorService: BuscadorService,
    public docService: CargarDocumentosJsonService,
    private nav: NavigationService,
    private narrator: NarratorService
  ) {}

  ngOnInit(): void {
    this.buscadorService.global_control_search_input = this.search;
    this.sub.add(
      this.search.valueChanges.pipe(debounceTime(400)).subscribe((v) => {
        this.buscadorService.buscar(v);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  first_view(): boolean {
    return !(
      this.buscadorService.terminos.puntos ||
      this.buscadorService.terminos.terminos
    );
  }

  get featured() {
    return this.docService.documentos_disponibles.map((doc) => ({
      doc,
      title: displayTitle({ title: doc.title, nombre: doc.nombre }),
      kindLine: kindLabel(kindFromName(doc.nombre, doc.kind)),
      sourceNote: doc.sourceNote,
    }));
  }

  goLibrary(): void {
    this.nav.go_to_documents();
  }

  openCover(doc: IndiceDocumentos): void {
    this.nav.document_selected = doc;
    this.nav.goToCover(doc.nombre);
  }

  listen(doc: IndiceDocumentos): void {
    void this.narrator.cancel();
    this.nav.openReading(doc, { autoNarr: true });
  }
}

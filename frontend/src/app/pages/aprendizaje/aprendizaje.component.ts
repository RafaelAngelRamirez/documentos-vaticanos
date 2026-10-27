import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import {
  claveAvisoImportacion,
  leerArchivoClase,
} from 'src/app/core/account/clase-archivo';
import {
  ClaseEnAparato,
  ClasesService,
} from 'src/app/core/account/clases.service';
import { indiceSiguiente, leidos } from 'src/app/core/account/clases.logic';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  selector: 'app-aprendizaje',
  imports: [
    CommonModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './aprendizaje.component.html',
  styleUrls: ['./aprendizaje.component.css'],
})
export class AprendizajeComponent implements OnInit, OnDestroy {
  copias: ClaseEnAparato[] = [];
  aviso: string | null = null;
  apiEnabled = Boolean(environment.apiBaseUrl);
  localeTick = 0;
  private sub = new Subscription();

  constructor(
    public i18n: UiI18nService,
    private clases: ClasesService,
    private router: Router,
    private navigation: NavigationService,
  ) {}

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  ngOnInit(): void {
    this.sub.add(
      this.i18n.locale$.subscribe(() => {
        this.localeTick++;
      }),
    );
    this.cargar();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  hechos(c: ClaseEnAparato): number {
    return leidos(c.clase.pasos, this.clases.progreso(c.clase.id));
  }

  pct(c: ClaseEnAparato): number {
    const total = c.clase.pasos.length;
    if (!total) return 0;
    return Math.round((this.hechos(c) / total) * 100);
  }

  abrir(c: ClaseEnAparato): void {
    void this.router.navigate(['/clases', c.clase.id]);
  }

  continuar(c: ClaseEnAparato): void {
    const hechos = this.clases.progreso(c.clase.id);
    const i = indiceSiguiente(c.clase.pasos, hechos);
    const paso = c.clase.pasos[i];
    if (!paso) return;
    this.clases.marcarPaso(c.clase.id, paso.id);
    this.navigation.openReading(paso.documentId, { unitIndex: paso.unitIndex });
  }

  async onFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await leerArchivoClase(file);
      const res = this.clases.importar(text);
      this.aviso = this.t(claveAvisoImportacion(res.codigo));
      this.cargar();
      if (res.ok && res.codigo !== 'misma') {
        await this.router.navigate(['/clases', res.id]);
      }
    } catch (err) {
      const codigo = err instanceof Error && err.message === 'grande' ? 'grande' : 'invalida';
      this.aviso = this.t(claveAvisoImportacion(codigo));
    }
  }

  private cargar(): void {
    this.copias = this.clases.alumnas();
  }
}

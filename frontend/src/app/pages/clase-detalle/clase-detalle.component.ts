import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import {
  claveAvisoImportacion,
  entregarArchivo,
  leerArchivoClase,
} from 'src/app/core/account/clase-archivo';
import {
  ClaseEnAparato,
  ClasesService,
  PasoClase,
} from 'src/app/core/account/clases.service';
import {
  indiceSiguiente,
  leidos,
  puedeArmarClase,
} from 'src/app/core/account/clases.logic';
import { AuthService } from 'src/app/core/auth/auth.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';
import { NavigationService } from 'src/app/services/navigation.service';

@Component({
  standalone: true,
  selector: 'app-clase-detalle',
  imports: [CommonModule, RouterModule, AppFbarComponent, BnavComponent, WbarComponent],
  templateUrl: './clase-detalle.component.html',
  styleUrls: ['./clase-detalle.component.css'],
})
export class ClaseDetalleComponent implements OnInit, OnDestroy {
  entry: ClaseEnAparato | null = null;
  hechos: Record<string, true> = {};
  aviso: string | null = null;
  confirmarSalida = false;
  localeTick = 0;
  private id = '';
  private sub = new Subscription();

  constructor(
    public i18n: UiI18nService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private clases: ClasesService,
    private navigation: NavigationService,
  ) {}

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  ngOnInit(): void {
    this.sub.add(this.i18n.locale$.subscribe(() => this.localeTick++));
    this.sub.add(
      this.route.paramMap.subscribe((pm) => {
        this.id = pm.get('id') || '';
        this.cargar();
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get esMaestro(): boolean {
    return this.entry?.papel === 'maestro';
  }

  get esPublica(): boolean {
    return this.entry?.clase.audiencia === 'publica';
  }

  get puedeExportar(): boolean {
    if (!this.entry || !this.entry.clase.pasos.length) return false;
    if (this.esPublica) return true;
    return this.esMaestro && this.puedeArmar;
  }

  get puedeArmar(): boolean {
    return puedeArmarClase({
      isLoggedIn: this.auth.isLoggedIn,
      isTeacher: this.auth.isTeacher,
    });
  }

  get doneCount(): number {
    if (!this.entry || this.esMaestro) return 0;
    return leidos(this.entry.clase.pasos, this.hechos);
  }

  get total(): number {
    return this.entry?.clase.pasos.length || 0;
  }

  get pct(): number {
    if (!this.total) return 0;
    return Math.round((this.doneCount / this.total) * 100);
  }

  get nextIndex(): number {
    if (!this.entry) return 0;
    return indiceSiguiente(this.entry.clase.pasos, this.hechos);
  }

  rotulo(p: PasoClase): string {
    return p.rotulo || `${p.documentId} · ${p.unitIndex}`;
  }

  hecho(p: PasoClase): boolean {
    return !this.esMaestro && this.hechos[p.id] === true;
  }

  esSiguiente(i: number): boolean {
    return !this.esMaestro && i === this.nextIndex && !this.hecho(this.entry!.clase.pasos[i]);
  }

  private cargar(): void {
    this.entry = this.clases.get(this.id);
    this.hechos = this.entry && this.entry.papel === 'alumno' ? this.clases.progreso(this.id) : {};
    this.confirmarSalida = false;
  }

  abrir(p: PasoClase): void {
    if (!this.esMaestro) this.clases.marcarPaso(this.id, p.id);
    this.cargar();
    this.navigation.openReading(p.documentId, { unitIndex: p.unitIndex });
  }

  continuar(): void {
    const pasos = this.entry?.clase.pasos || [];
    const p = pasos[this.nextIndex];
    if (p) this.abrir(p);
  }

  async exportar(): Promise<void> {
    const res = this.clases.exportar(this.id);
    if (!res.ok) {
      this.aviso = this.t(
        res.codigo === 'nolista'
          ? 'clase.need_ready'
          : res.codigo === 'alumno'
            ? 'clase.need_teacher'
            : 'clase.need_step',
      );
      return;
    }
    await entregarArchivo(res.nombre, res.json);
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
      if (res.ok && res.id !== this.id) {
        await this.router.navigate(['/clases', res.id]);
        return;
      }
      this.cargar();
    } catch (err) {
      const codigo = err instanceof Error && err.message === 'grande' ? 'grande' : 'invalida';
      this.aviso = this.t(claveAvisoImportacion(codigo));
    }
  }

  aceptar(): void {
    const res = this.clases.aceptar(this.id);
    this.aviso = res.ok ? this.t('clase.saved') : this.t('clase.invalid');
    this.cargar();
  }

  conservar(): void {
    this.clases.conservar(this.id);
    this.cargar();
  }

  salir(): void {
    this.clases.borrar(this.id);
    void this.router.navigate(this.esMaestro ? ['/estudios'] : ['/aprendizaje']);
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { WbarComponent } from 'src/app/components/wbar/wbar.component';
import { entregarArchivo } from 'src/app/core/account/clase-archivo';
import {
  ClaseEnAparato,
  ClasesService,
  MAX_PASOS,
  PasoClase,
} from 'src/app/core/account/clases.service';
import { puedeArmarClase } from 'src/app/core/account/clases.logic';
import { AuthService } from 'src/app/core/auth/auth.service';
import { UiI18nService } from 'src/app/core/i18n/ui-i18n.service';

@Component({
  standalone: true,
  selector: 'app-clase-editar',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AppFbarComponent,
    BnavComponent,
    WbarComponent,
  ],
  templateUrl: './clase-editar.component.html',
  styleUrls: ['./clase-editar.component.css'],
})
export class ClaseEditarComponent implements OnInit, OnDestroy {
  entry: ClaseEnAparato | null = null;
  aviso: string | null = null;
  confirmarBorrado = false;
  localeTick = 0;
  readonly tope = MAX_PASOS;
  private id = '';
  private sub = new Subscription();

  meta = new FormGroup({
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    descripcion: new FormControl('', { nonNullable: true }),
  });

  paso = new FormGroup({
    documentId: new FormControl('cic-es', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    unitIndex: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    rotulo: new FormControl('', { nonNullable: true }),
    nota: new FormControl('', { nonNullable: true }),
  });

  constructor(
    public i18n: UiI18nService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private clases: ClasesService,
  ) {}

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  get puedeArmar(): boolean {
    return puedeArmarClase({
      isLoggedIn: this.auth.isLoggedIn,
      isTeacher: this.auth.isTeacher,
    });
  }

  get detalleLink(): string {
    return `/clases/${this.id}`;
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

  rotulo(p: PasoClase): string {
    return p.rotulo || `${p.documentId} · ${p.unitIndex}`;
  }

  private cargar(): void {
    const entry = this.clases.get(this.id);
    if (!entry || entry.papel !== 'maestro') {
      void this.router.navigate(entry ? ['/clases', this.id] : ['/estudios']);
      return;
    }
    this.entry = entry;
    this.meta.patchValue({
      titulo: entry.clase.titulo,
      descripcion: entry.clase.descripcion || '',
    });
  }

  private aplicar(res: { ok: true; entry: ClaseEnAparato } | { ok: false; codigo: string }): void {
    if (!res.ok) {
      const params = res.codigo === 'tope' ? { n: MAX_PASOS } : undefined;
      this.aviso = this.t(this.claveError(res.codigo), params);
      return;
    }
    this.entry = res.entry;
    this.aviso = this.t('clase.saved');
  }

  private claveError(codigo: string): string {
    switch (codigo) {
      case 'tope':
        return 'clase.cap';
      case 'vacia':
        return 'clase.need_step';
      case 'nolista':
        return 'clase.need_ready';
      case 'titulo':
        return 'clase.bad_title';
      case 'alumno':
        return 'clase.need_teacher';
      default:
        return 'clase.bad_cite';
    }
  }

  guardar(): void {
    if (!this.puedeArmar || !this.entry) return;
    const v = this.meta.getRawValue();
    this.aplicar(this.clases.guardarMeta(this.id, v.titulo, v.descripcion));
  }

  agregar(): void {
    if (!this.puedeArmar || !this.entry || this.paso.invalid) return;
    const v = this.paso.getRawValue();
    const res = this.clases.agregarPaso(this.id, {
      documentId: v.documentId.trim(),
      unitIndex: Number(v.unitIndex),
      rotulo: v.rotulo,
      nota: v.nota,
    });
    this.aplicar(res);
    if (res.ok) this.paso.patchValue({ rotulo: '', nota: '' });
  }

  quitar(pasoId: string): void {
    if (!this.puedeArmar) return;
    this.aplicar(this.clases.quitarPaso(this.id, pasoId));
  }

  mover(pasoId: string, dir: number): void {
    if (!this.puedeArmar) return;
    const step: -1 | 1 = dir < 0 ? -1 : 1;
    this.aplicar(this.clases.moverPaso(this.id, pasoId, step));
  }

  toggleLista(): void {
    if (!this.puedeArmar || !this.entry) return;
    this.aplicar(this.clases.marcarLista(this.id, !this.entry.listaParaAlumnos));
  }

  async exportar(): Promise<void> {
    if (!this.puedeArmar) return;
    const res = this.clases.exportar(this.id);
    if (!res.ok) {
      this.aviso = this.t(this.claveError(res.codigo));
      return;
    }
    await entregarArchivo(res.nombre, res.json);
  }

  borrar(): void {
    this.clases.borrar(this.id);
    void this.router.navigate(['/estudios']);
  }
}

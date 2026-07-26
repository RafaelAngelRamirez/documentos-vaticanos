import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LectorComponent } from '../components/lector/lector.component';
import { ROUTE } from '../services/navigation.service';
import { InicioComponent } from './inicio/inicio.component';
import { ListDocumentsPagesComponent } from './list-documents-pages/list-documents-pages.component';
import { AboutComponent } from './about/about.component';
import { CuentaComponent } from './cuenta/cuenta.component';
import { MisReferenciasComponent } from './mis-referencias/mis-referencias.component';
import { MisTemasComponent } from './mis-temas/mis-temas.component';
import { TemaDetalleComponent } from './tema-detalle/tema-detalle.component';
import { EstudiosComponent } from './estudios/estudios.component';
import { EstudioDetalleComponent } from './estudio-detalle/estudio-detalle.component';
import { EstudioEditarComponent } from './estudio-editar/estudio-editar.component';
import { BuscarComponent } from './buscar/buscar.component';
import { AprendizajeComponent } from './aprendizaje/aprendizaje.component';
import { ExplorarComponent } from './explorar/explorar.component';
import { TopicoDetalleComponent } from './topico-detalle/topico-detalle.component';
import { AjustesComponent } from './ajustes/ajustes.component';
import { DocumentoDetalleComponent } from './documento-detalle/documento-detalle.component';
import { NotasComponent } from './notas/notas.component';
import { AdminRevisionComponent } from './admin-revision/admin-revision.component';
import { AdminRevisionDetalleComponent } from './admin-revision-detalle/admin-revision-detalle.component';
import { PadresComponent } from './padres/padres.component';
import { PadreDetalleComponent } from './padre-detalle/padre-detalle.component';
import { DoctoresComponent } from './doctores/doctores.component';
import { DoctorDetalleComponent } from './doctor-detalle/doctor-detalle.component';
import { SantoralComponent } from './santoral/santoral.component';
import { SantoDetalleComponent } from './santo-detalle/santo-detalle.component';

const routes: Routes = [
  { path: ROUTE.inicio, component: InicioComponent },
  { path: ROUTE.about, component: AboutComponent },
  { path: ROUTE.list_documents, component: ListDocumentsPagesComponent },
  /** Design alias */
  { path: 'biblioteca', component: ListDocumentsPagesComponent },
  { path: 'buscar', component: BuscarComponent },
  { path: 'cuenta', component: CuentaComponent },
  { path: 'cuenta/referencias', component: MisReferenciasComponent },
  { path: 'cuenta/temas', component: MisTemasComponent },
  /** Design 3G */
  { path: 'notas', component: NotasComponent },
  { path: 'cuenta/temas/:id', component: TemaDetalleComponent },
  /** Design hub 1C */
  { path: 'estudio', component: EstudiosComponent },
  { path: 'estudios', component: EstudiosComponent },
  { path: 'estudios/:id/editar', component: EstudioEditarComponent },
  { path: 'estudios/:id', component: EstudioDetalleComponent },
  /** Design 1D / 1E */
  { path: 'aprendizaje', component: AprendizajeComponent },
  /** PR6 · tema del corpus (índice temático offline); more specific before explorar */
  { path: 'explorar/topicos/:slug', component: TopicoDetalleComponent },
  { path: 'explorar', component: ExplorarComponent },
  { path: 'ajustes', component: AjustesComponent },
  { path: 'documento/:id', component: DocumentoDetalleComponent },
  /** Diseño 6C · 6D · cola de revisión (admin) */
  { path: 'admin/revision', component: AdminRevisionComponent },
  { path: 'admin/revision/:id', component: AdminRevisionDetalleComponent },
  /** Diseño 2C · 2D · Padres de la Iglesia */
  { path: 'padres', component: PadresComponent },
  { path: 'padres/:id', component: PadreDetalleComponent },
  /** Doctores de la Iglesia (mismo patrón 2C · 2D) */
  { path: 'doctores', component: DoctoresComponent },
  { path: 'doctores/:id', component: DoctorDetalleComponent },
  /** Santoral offline (vatican.va + Padres/autores del corpus) */
  { path: 'santoral', component: SantoralComponent },
  { path: 'santoral/:id', component: SantoDetalleComponent },
  {
    path: `${ROUTE.leyendo}/:documento`,
    component: LectorComponent,
  },
  {
    path: `${ROUTE.leyendo}/:id/${ROUTE.punto}/:user`,
    component: LectorComponent,
  },
  { path: '**', redirectTo: `/${ROUTE.inicio}`, pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {}

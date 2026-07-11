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
  { path: 'cuenta/temas/:id', component: TemaDetalleComponent },
  /** Design hub 1C */
  { path: 'estudio', component: EstudiosComponent },
  { path: 'estudios', component: EstudiosComponent },
  { path: 'estudios/:id/editar', component: EstudioEditarComponent },
  { path: 'estudios/:id', component: EstudioDetalleComponent },
  /** Design 1D / 1E */
  { path: 'aprendizaje', component: AprendizajeComponent },
  { path: 'explorar', component: ExplorarComponent },
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

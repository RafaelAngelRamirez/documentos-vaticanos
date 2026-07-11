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

const routes: Routes = [
  {
    path: ROUTE.inicio,
    component: InicioComponent,
  },
  {
    path: ROUTE.about,
    component: AboutComponent,
  },
  {
    path: ROUTE.list_documents,
    component: ListDocumentsPagesComponent,
  },
  {
    path: 'cuenta',
    component: CuentaComponent,
  },
  {
    path: 'cuenta/referencias',
    component: MisReferenciasComponent,
  },
  {
    path: 'cuenta/temas',
    component: MisTemasComponent,
  },
  {
    path: 'cuenta/temas/:id',
    component: TemaDetalleComponent,
  },
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

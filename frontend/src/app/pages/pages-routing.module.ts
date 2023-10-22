import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LectorComponent } from '../components/lector/lector.component';
import { ROUTE } from '../services/navigation.service';
import { InicioComponent } from './inicio/inicio.component';
import { ListDocumentsPagesComponent } from './list-documents-pages/list-documents-pages.component';
LectorComponent;

const routes: Routes = [
  {
    path: ROUTE.inicio,
    component: InicioComponent,
  },
  {
    path: ROUTE.list_documents,
    component: ListDocumentsPagesComponent,
  },
  {
    path: `${ROUTE.leyendo}/:documento`,
    component: LectorComponent,
  },
  {
    path: `${ROUTE.leyendo}/:id/${ROUTE.punto}/:user`,
    component: LectorComponent,
  },

  // { path: '**', redirectTo: `/${ROUTE.inicio}`, pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {}

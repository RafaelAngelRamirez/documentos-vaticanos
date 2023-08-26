import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LectorComponent } from '../components/lector/lector.component';
import { ROUTE } from '../services/navigation.service';
LectorComponent;

const routes: Routes = [
  {
    path: ROUTE.inicio,
    loadChildren: () =>
      import('./inicio/inicio.module').then((m) => m.InicioModule),
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

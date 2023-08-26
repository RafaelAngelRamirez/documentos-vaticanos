import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LectorComponent } from '../components/lector/lector.component';

LectorComponent;

const routes: Routes = [
  {
    path: 'inicio',
    loadChildren: () =>
      import('./inicio/inicio.module').then((m) => m.InicioModule),
  },
  {
    path: 'leyendo/:documento',
    component: LectorComponent,
  },
  {
    path: 'leyendo/:id/punto/:user',
    component: LectorComponent,
  },

  { path: '**', redirectTo: '/inicio', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PagesRoutingModule {}

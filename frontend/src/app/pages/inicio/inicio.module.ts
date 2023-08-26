import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { InicioRoutingModule } from './inicio-routing.module';
import { InicioComponent } from './inicio.component';
import { PuntoModule } from 'src/app/components/punto/punto.module';
import { BuscadorComponent } from 'src/app/components/buscador/buscador.component';

@NgModule({
  declarations: [
    InicioComponent
  ],
  imports: [
    CommonModule,
    InicioRoutingModule,
    PuntoModule,
    BuscadorComponent,
  ]
})
export class InicioModule { }

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PuntoComponent } from './punto/punto.component';
import { PuntoResaltadoTerminosComponent } from './punto-resaltado-terminos/punto-resaltado-terminos.component';



@NgModule({
  declarations: [
    PuntoComponent,
    PuntoResaltadoTerminosComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    PuntoComponent
  ]
})
export class PuntoModule { }

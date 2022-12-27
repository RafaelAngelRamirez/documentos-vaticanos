import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PuntoComponent } from './punto/punto.component';



@NgModule({
  declarations: [
    PuntoComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    PuntoComponent
  ]
})
export class PuntoModule { }

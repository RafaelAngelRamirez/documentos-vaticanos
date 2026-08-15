import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PagesRoutingModule } from './pages-routing.module';
import { PagesComponent } from './pages.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { LectorComponent } from '../components/lector/lector.component';
import { ListDocumentsPagesComponent } from './list-documents-pages/list-documents-pages.component';
import { AboutComponent } from './about/about.component';
import { BnavComponent } from '../components/bnav/bnav.component';
import { InicioComponent } from './inicio/inicio.component';

@NgModule({
  declarations: [PagesComponent, ListDocumentsPagesComponent, AboutComponent],
  imports: [
    CommonModule,
    PagesRoutingModule,
    NavbarComponent,
    BnavComponent,
    InicioComponent,
    LectorComponent,
  ],
})
export class PagesModule {}

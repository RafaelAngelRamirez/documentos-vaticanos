import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PagesRoutingModule } from './pages-routing.module';
import { PagesComponent } from './pages.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { ListDocumentsPagesComponent } from './list-documents-pages/list-documents-pages.component';

@NgModule({
  declarations: [PagesComponent, ListDocumentsPagesComponent],
  imports: [CommonModule, PagesRoutingModule, NavbarComponent],
})
export class PagesModule {}

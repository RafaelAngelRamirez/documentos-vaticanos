import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PagesRoutingModule } from './pages-routing.module';
import { PagesComponent } from './pages.component';
import { NavbarComponent } from '../components/navbar/navbar.component'
import { NavbarModule } from '../components/navbar/navbar.module'

@NgModule({
  declarations: [
    PagesComponent
  ],
  imports: [CommonModule, PagesRoutingModule, NavbarModule],
})
export class PagesModule {}

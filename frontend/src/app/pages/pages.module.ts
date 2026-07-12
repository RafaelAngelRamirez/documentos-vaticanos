import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PagesRoutingModule } from './pages-routing.module';
import { PagesComponent } from './pages.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { AboutComponent } from './about/about.component';

@NgModule({
  declarations: [PagesComponent, AboutComponent],
  imports: [CommonModule, PagesRoutingModule, NavbarComponent],
})
export class PagesModule {}

import { Component, OnInit } from '@angular/core';
import { DarkReaderService } from 'src/app/services/dark-reader.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {
  constructor(public darkModeService: DarkReaderService) {}

  temaClaro = true;
  tema(claro = this.temaClaro) {
    console.log({ claro });
    if (!claro) this.darkModeService.dark();
    else this.darkModeService.disable();
  }

  ngOnInit(): void {}
}

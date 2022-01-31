import { Component } from '@angular/core';

import { DarkReaderService } from './services/dark-reader.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'documentos-vaticanos';

  constructor(public darkModeService: DarkReaderService) {}

  temaClaro = true;
  tema(claro = this.temaClaro) {
    console.log({ claro });
    if (!claro) this.darkModeService.dark();
    else this.darkModeService.disable();
  }
}

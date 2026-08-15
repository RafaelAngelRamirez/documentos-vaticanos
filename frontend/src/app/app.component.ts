import { Component, OnInit } from '@angular/core';
import { SafeAreaService } from './core/shell/safe-area.service';
import { ReaderPreferencesService } from './services/reader-preferences.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  constructor(
    private safeArea: SafeAreaService,
    private readerPrefs: ReaderPreferencesService
  ) {}

  ngOnInit(): void {
    this.safeArea.init();
    this.readerPrefs.applyToDom();
  }
}

import { Injectable } from '@angular/core';
import * as DarkReader from 'darkreader';

@Injectable({
  providedIn: 'root',
})
export class DarkReaderService {
  constructor() {}

  dark = () =>
    DarkReader.enable({
      brightness: 90,
      contrast: 70,
      sepia: 10,
    });

  disable = () => DarkReader.disable();
}

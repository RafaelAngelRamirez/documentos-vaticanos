import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MensajesService {
  error = new Error();
  constructor() {}
}

class Error {
  general(msj: string) {
    alert(msj);
  }
}

import { Injectable } from '@angular/core';

import Catecismo from '../../assets/documentos/catecismo.json';

@Injectable({
  providedIn: 'root',
})
export class CargarDocumentosJsonService {
  catecismo: Punto[] = Catecismo as Punto[]
  constructor() {}
}

export interface Punto {
  consecutivo: string;
  contenido: string;
  referencias: [
    {
      descripcion: string;
      url: string;
      local: {
        idDocumento: '';
        idPunto: '';
      };
    }
  ];
}

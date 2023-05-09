import { Injectable } from '@angular/core';

import Catecismo from '../../assets/documentos/catecismo.json';

@Injectable({
  providedIn: 'root',
})
export class CargarDocumentosJsonService {
  catecismo: Punto[] = Catecismo as Punto[];

  documentos_disponibles: IndiceDocumentos[] = [];

  constructor() {
    this.documentos_disponibles.push({
      nombre: 'Catecismo',
      documento: this.catecismo,
    });
  }
}

export interface IndiceDocumentos {
  nombre: string;
  documento: Punto[];
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

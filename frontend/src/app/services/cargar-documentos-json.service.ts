import { Injectable } from '@angular/core';

import Catecismo from '../../assets/documentos/catecismo.json';
import Catecismo_index from '../../assets/documentos/catecismo.index.json';

@Injectable({
  providedIn: 'root',
})
export class CargarDocumentosJsonService {
  catecismo: Punto[] = Catecismo as Punto[];
  catecismo_index = Catecismo_index as Indice;

  documentos_disponibles: IndiceDocumentos[] = [];

  constructor() {
    this.documentos_disponibles.push({
      nombre: 'Catecismo',
      documento: this.catecismo,
      indice: this.catecismo_index,
    });
  }
}

export interface IndiceDocumentos {
  nombre: string;
  documento: Punto[];
  indice: Indice;
}

export interface Indice {
  indice: {
    [key: string]: number[];
  };

  /**
   *La llave es el numero de indice del arreglo, y el valor
   * es el numero de punto. 
   *
   * @type {({
   *     [key: number]: number | null;
   *   })}
   * @memberof Indice
   */
  indice_por_punto: {
    [key: number]: number | null;
  };
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

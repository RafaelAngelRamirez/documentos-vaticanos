import { Injectable } from '@angular/core';

import Catecismo from '../../assets/documentos/catecismo.json';
import Catecismo_index from '../../assets/documentos/catecismo.index.json';

@Injectable({
  providedIn: 'root',
})
export class CargarDocumentosJsonService {
  catecismo: Article[] = Catecismo as Article[];
  catecismo_index = Catecismo_index as Indice;

  documentos_disponibles: IndiceDocumentos[] = [];

  constructor() {
    this.loadDocumentsInMemory();
  }

  loadDocumentsInMemory() {
    this.documentos_disponibles.push({
      nombre: 'Catecismo',
      documento: this.catecismo,
      indice: this.catecismo_index,
    });

    this.documentos_disponibles.forEach((doc) => {
      doc.documento.forEach((article, i) => {
        article.index_array = i;
      });
    });
    console.log('The Documents have been loaded.');
  }
}

export interface IndiceDocumentos {
  nombre: string;
  documento: Article[];
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

export interface Article {
  /**
   *The index_array is the index positión inside the array of
   * articles. Must be copied at first load to make more easy
   * the navigation between components.
   *
   * @type {number}
   * @memberof Article
   */
  index_array: number;
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

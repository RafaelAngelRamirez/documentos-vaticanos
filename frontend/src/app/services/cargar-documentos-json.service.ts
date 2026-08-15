import { Injectable } from '@angular/core';

import Catecismo from '../../assets/documentos/catecismo.json';
import Catecismo_index from '../../assets/documentos/catecismo.index.json';
import Biblia from '../../assets/documentos/biblia_en_puntos.json';
import Biblia_index from '../../assets/documentos/biblia.index.json';

@Injectable({
  providedIn: 'root',
})
export class CargarDocumentosJsonService {
  catecismo: Article[] = Catecismo as Article[];
  catecismo_index = Catecismo_index as Indice;

  biblia: Article[] = Biblia as Article[];
  biblia_index = Biblia_index as Indice;

  documentos_disponibles: IndiceDocumentos[] = [];

  constructor() {
    this.loadDocumentsInMemory();
  }

  loadDocumentsInMemory() {
    this.documentos_disponibles.push({
      id: 'catecismo-es',
      nombre: 'Catecismo',
      title: 'Catecismo de la Iglesia Católica',
      shortTitle: 'Catecismo',
      kind: 'catechism',
      locale: 'es',
      sourceUrl: 'https://www.vatican.va/archive/catechism_sp/index_sp.html',
      sourceNote: 'Texto oficial en español publicado por la Santa Sede.',
      documento: this.catecismo,
      indice: this.catecismo_index,
    });

    this.documentos_disponibles.push({
      id: 'biblia-es',
      nombre: 'Biblia',
      title: 'Sagrada Biblia (Pueblo de Dios)',
      shortTitle: 'Biblia',
      kind: 'bible',
      locale: 'es',
      sourceUrl: 'https://www.vatican.va/archive/ESL0506/_INDEX.HTM',
      sourceNote: 'Edición del Pueblo de Dios publicada en vatican.va.',
      documento: this.biblia,
      indice: this.biblia_index,
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
  id?: string;
  nombre: string;
  title?: string;
  shortTitle?: string;
  kind?: string;
  locale?: string;
  translationProvenance?: 'ai' | 'human' | 'source';
  sourceNote?: string;
  sourceUrl?: string;
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
  referencias?: Referencia[];
  biblia?: {
    consecutivo_versiculo: string;
    versiculo: number;
    capitulo: string;
    libro: string;
    index_general: number;
  };
}

export interface Referencia {
  descripcion: string;
  url: string;
  local: {
    idDocumento: '';
    idPunto: '';
  };
}

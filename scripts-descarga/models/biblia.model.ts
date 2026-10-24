import { CorpusUnit } from "./transport_data.model";

export interface Biblia {
  // Testamento
  [key: string]: {
    // Libro
    [key: string]: {
      // Capitulo
      [key: string]: {
        versiculos: Versiculo[] | CorpusUnit[];
      };
    };
  };
}

export interface Versiculo {
  versiculo: string;
  contenido: string;
}

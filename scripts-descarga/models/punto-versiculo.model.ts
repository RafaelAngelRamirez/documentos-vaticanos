import { Versiculo } from "./biblia.model";

export interface GenerarPuntoBiblia {
  k_testamento: string;
  k_libro: string;
  k_libro_abr: string;
  k_capitulo: string;
  versiculo: Versiculo;
  index_general: string;
}

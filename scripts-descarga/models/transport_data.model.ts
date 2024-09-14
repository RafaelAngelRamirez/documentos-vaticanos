export interface TrasnportData {
  consecutivo: string;
  contenido: string;
  referencias?: Reference[];
  index_array?: number;
  biblia?: {
    consecutivo_versiculo: string;
    versiculo: number;
    capitulo: string;
    libro: string;
    index_general: string;
  };
}

export interface Reference {
  descripcion:string
}

export interface BibleBook {
    _capitulo: string;
    _libro: string;
    _testamento: string;
    document:Document

}


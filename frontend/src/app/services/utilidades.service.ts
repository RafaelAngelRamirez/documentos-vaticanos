import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilidadesService {
  texto = new Texto();
  constructor() {}
}

class Texto {
  /**
   * Elimina todos los diacriticos menos la Ñ.
   * https://es.stackoverflow.com/questions/62031/eliminar-signos-diacríticos-en-javascript-eliminar-tildes-acentos-ortográficos
   * @param {string} texto
   * @returns El texto sin acentos, diacritos, menos Ñ
   */
  eliminar_diacriticos(texto: string) {
    return texto
      .normalize('NFD')
      .replace(
        /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
        '$1'
      )
      .normalize();
  }
}

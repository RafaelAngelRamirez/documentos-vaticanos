import { EventEmitter, Injectable } from '@angular/core';
import { MensajesService } from 'src/services/mensajes.service';

@Injectable({
  providedIn: 'root',
})
export class BuscadorService {
  constructor(private mensajeService: MensajesService) {}

  terminos: TerminosProcesados = {};
  terminos_emit = new EventEmitter<TerminosProcesados>();

  buscar(v: string | null) {
    if (v) this.terminos = this.procesar_cadena_de_terminos(v);
    else this.terminos = {};
    this.terminos_emit.emit(this.terminos);
  }

  /**
   * Separamos los terminos por comas, que deben ser
   * terminos completos, y por puntos, que deben iniciar
   * por un punto. Ejemlos.
   *  1. Terminos textuales.
   *    - catecismo, cristo, cruz
   *  2. Busqueda por puntos.
   *    - .123, .3455-3460
   *  3. Terminos textuales y busqueda por puntos.
   *    - catecismo, .200-205, .1000
   *
   * @param {string} t El termino
   * @memberof BuscadorService
   */
  procesar_cadena_de_terminos(t: string): TerminosProcesados {
    let valores = t
      .split(',')
      .map((v) => v.trim())
      .filter((x) => x !== '');
    let terminos = valores.filter((v) => v[0] !== '.');
    let puntos: number[] = valores
      .filter((v) => v[0] === '.')
      .map((v) => v.replace('.', ''))
      .reduce((previus, currentValue) => {
        // Si incluye un guión, debemos generar el rango.
        let sucesion = currentValue.split('-');

        if (sucesion.length > 2)
          this.mensajeService.error.general(
            `El termino ${currentValue} no se puede procesar y se ignorará`
          );
        else {
          let sucesion_numeros = sucesion
            .map((v) => {
              // Deben ser numeros
              let is_nan = parseInt(v);
              if (!is_nan) {
                console.log(
                  `Uno de los terminos para obtener puntos no es correcto "${v}" `
                );
                return -1;
              }

              return is_nan;
            })
            .filter((x) => x > 0)
            .sort((a, b) => (a > b ? 1 : -1));

          if (sucesion_numeros.length === 2) {
            let inferior = sucesion_numeros[0];
            let superior = sucesion_numeros[1];

            let diferencia = 0;
            if (inferior && superior) {
              diferencia = superior - inferior;

              sucesion_numeros = new Array(diferencia)
                .fill(0)
                .map((v, i) => inferior + i);

              sucesion_numeros.push(superior);
            }
          }

          return [...new Set([...previus, ...sucesion_numeros])];
        }
        return [];
      }, [] as any);

    terminos.sort();
    puntos.sort((a, b) => (a > b ? 1 : -1));

    let resultados = {
      terminos,
      puntos,
    };
    return resultados;
  }
}

export interface TerminosProcesados {
  terminos?: string[];
  puntos?: number[];
}

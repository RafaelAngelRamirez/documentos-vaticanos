import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { Punto } from 'src/app/services/cargar-documentos-json.service';
import { TerminosProcesados } from '../../buscador/buscador.service';
import { UtilidadesService } from 'src/app/services/utilidades.service';

@Component({
  selector: 'app-punto',
  templateUrl: './punto.component.html',
  styleUrls: ['./punto.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class PuntoComponent implements OnInit {
  private _infoPunto!: InfoPunto;
  mostrar_opciones = false;

  ver_raw = false;
  public get infoPunto(): InfoPunto {
    return this._infoPunto;
  }
  @Input()
  public set infoPunto(value: InfoPunto) {
    this._infoPunto = this.procesar(value);
  }

  terminos_de_busqueda: string[] = [];

  constructor(private utilidadesService: UtilidadesService) {}

  ngOnInit(): void {}

  procesar(value: InfoPunto): InfoPunto {
    if (!value) return value;
    let procesado = value;

    procesado = this.popularReferencias(procesado);
    if (this.terminos_de_busqueda)
      procesado = this.terminos_de_busqueda_procesar(
        JSON.parse(JSON.stringify(procesado))
      );

    return procesado;
  }

  popularReferencias(procesado: InfoPunto): InfoPunto {
    let cadena_de_remplazo = (i: number) => `[+[${i}]+]`;
    procesado.punto.referencias.forEach((referencia, i) => {
      let remplazar = cadena_de_remplazo(i);
      procesado.punto.contenido = procesado.punto.contenido.replace(
        remplazar,
        referencia.descripcion
      );
    });

    return procesado;
  }

  /**
   *Obtenemos el consecutivo cuando existe. El consecutivo
   * se refiere al valor que se asigna como un control
   * numérico para referencia del docuemento.
   *
   * @param {(string | undefined)} consecutivo
   * @return {*}
   * @memberof PuntoComponent
   */
  obtener_consecutivo(consecutivo: string | undefined) {
    if (!consecutivo) return consecutivo;

    let valor = consecutivo.trim();

    if (valor === 'no-encontrado') valor = '';
    return valor;
  }

  /**
   *El texto origianl del punto incluye la descripción del
   * del punto. Como no queremos que se duplique con esta
   * función lo eliminamos de nuestro resultado a mostrar.
   *
   * @param {(Punto | undefined)} punto
   * @return {*}
   * @memberof PuntoComponent
   */
  ocultar_consecutivo(punto: Punto | undefined) {
    if (!punto) return '';
    let contenido = punto.contenido;
    let consecutivo = punto.consecutivo.trim();

    return contenido.replace(consecutivo + ' ', '');
  }

  terminos_de_busqueda_procesar(infoPunto: InfoPunto): InfoPunto {
    let punto = infoPunto.punto.contenido;
    let terminos = infoPunto.terminos_crudos;
    let punto_transformado = this.utilidadesService.texto
      .eliminar_diacriticos(punto)
      .toLowerCase();

    let caracter_inicio = '@';
    let caracter_fin = '$';

    terminos?.forEach((termino) => {
      let remplazo = termino.split('').fill('%');
      remplazo[0] = caracter_inicio;
      remplazo[termino.length] = caracter_fin;
      let remplazo_str = remplazo.join('');
      punto_transformado = punto_transformado.replaceAll(termino, remplazo_str);
    });


    let indices: number[] = [];

    punto_transformado.split('').forEach((l, i) => {
      if (l === caracter_inicio) {
        indices.push(i);
      }
      if (l === caracter_fin) {
        indices.push(i);
      }
    });

    let es_final = true;

    let etiqueta_inicio = '<span class="resaltar">';
    let etiqueta_fin = '</span>';
    indices.reverse().forEach((indice) => {
      const primera_parte = punto.slice(0, indice);
      const segunda_parte = punto.slice(indice);
      const etiqueta = es_final ? etiqueta_fin : etiqueta_inicio;
      punto = primera_parte + etiqueta + segunda_parte;
      es_final = !es_final;
    });

    infoPunto.punto.contenido = punto;

    return infoPunto;
  }
}

export interface InfoPunto {
  punto: Punto;
  terminos?: TerminosProcesados;
  terminos_crudos: string[];
}

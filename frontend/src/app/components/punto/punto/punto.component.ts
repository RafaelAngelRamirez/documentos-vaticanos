import { Component, Input, OnInit } from '@angular/core';
import { Punto } from 'src/app/services/cargar-documentos-json.service';

@Component({
  selector: 'app-punto',
  templateUrl: './punto.component.html',
  styleUrls: ['./punto.component.css'],
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

  constructor() {}

  ngOnInit(): void {}

  procesar(value: InfoPunto): InfoPunto {
    if (!value) return value;
    let procesado = value;

    procesado = this.popularReferencias(procesado);
    if (this.terminos_de_busqueda)
      procesado = this.terminos_de_busqueda_procesar(procesado);

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
    return infoPunto;
  }
}

interface InfoPunto {
  punto: Punto;
  terminos?: string[];
}

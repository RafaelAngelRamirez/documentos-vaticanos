import { Component, Input, OnInit } from '@angular/core';
import { Punto } from 'src/app/services/cargar-documentos-json.service';

@Component({
  selector: 'app-punto',
  templateUrl: './punto.component.html',
  styleUrls: ['./punto.component.css'],
})
export class PuntoComponent implements OnInit {
  private _punto: Punto | undefined = undefined;

  ver_raw = false
  public get punto(): Punto | undefined {
    return this._punto;
  }
  @Input()
  public set punto(value: Punto | undefined) {
    this._punto = this.procesar(value);
  }

  constructor() {}

  ngOnInit(): void {}

  procesar(value: Punto | undefined): Punto | undefined {
    if (!value) return value;
    let procesado: Punto = value;

    procesado = this.popularReferencias(procesado);

    return procesado;
  }

  popularReferencias(procesado: Punto): Punto {
    let cadena_de_remplazo = (i: number) => `[+[${i}]+]`;
    procesado.referencias.forEach((referencia, i) => {
      let remplazar = cadena_de_remplazo(i);
      procesado.contenido = procesado.contenido.replace(remplazar, referencia.descripcion);
    });

    return procesado;
  }


  obtener_consecutivo(consecutivo:string | undefined){

    if(!consecutivo) return consecutivo
    
    let valor = consecutivo.trim()

    if(valor==='no-encontrado') valor = ''
    return valor
  }
}

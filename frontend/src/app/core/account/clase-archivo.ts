import { MAX_ARCHIVO_BYTES } from './clases.logic';

/** Clave de interfaz para el resultado de importar un archivo. */
export function claveAvisoImportacion(codigo: string): string {
  switch (codigo) {
    case 'nueva':
      return 'clase.imported';
    case 'pendiente':
      return 'clase.pending';
    case 'misma':
      return 'clase.same';
    case 'propia':
      return 'clase.own';
    case 'antigua':
      return 'clase.older';
    case 'publica':
      return 'clase.public_file';
    case 'grande':
      return 'clase.too_big';
    default:
      return 'clase.invalid';
  }
}

export function leerArchivoClase(file: File): Promise<string> {
  if (file.size > MAX_ARCHIVO_BYTES) {
    return Promise.reject(new Error('grande'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('invalida'));
    reader.readAsText(file);
  });
}

/** Entrega el JSON de la clase: hoja de compartir en el teléfono, o descarga. */

export async function entregarArchivo(
  nombre: string,
  json: string,
): Promise<'share' | 'download' | 'cancel'> {
  const file = new File([json], nombre, { type: 'application/json' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const canShare = nav?.canShare?.({ files: [file] }) === true;
  if (canShare && nav?.share) {
    try {
      await nav.share({ files: [file], title: nombre });
      return 'share';
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'AbortError') return 'cancel';
    }
  }
  if (typeof document === 'undefined') return 'cancel';
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'download';
}

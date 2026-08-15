/** Minimal UI catalog (es). Keys used by reader / CTAs / chrome. */
export const ES: Record<string, string> = {
  'app.name': 'Documentos Vaticanos',
  'nav.home': 'Inicio',
  'nav.library': 'Biblioteca',
  'nav.about': 'Acerca de',
  'nav.bottom_aria': 'Navegación principal',
  'inicio.title': 'Documentos Vaticanos',
  'inicio.lede':
    'Catecismo, Escritura y magisterio. Offline, sin cuenta, para leer y escuchar.',
  'inicio.start': 'Empezar',
  'inicio.search_hint':
    'Frases e intenciones valen (p. ej. el amor de Dios). También un término (fe) o un punto (.27 · .200-205).',
  'library.title': 'Biblioteca',
  'library.empty': 'Catálogo no disponible.',
  'library.loading': 'Cargando documentos…',
  'library.read': 'Comenzar la lectura',
  'library.listen': '▶ Escuchar con narrador',
  'library.continue': 'Continuar la lectura',
  'reader.narrator': 'Narrador',
  'reader.narrator_aria': 'Controles del narrador',
  'reader.play': 'Reproducir',
  'reader.pause': 'Pausar',
  'reader.stop': 'Detener',
  'reader.continue': 'Continuar',
  'reader.prefs_aria': 'Ajustes de lectura',
  'reader.prefs_title': 'Lectura',
  'reader.loading_document': 'Cargando documento…',
  'reader.doc_start': 'Inicio del documento',
  'reader.load_before': 'Cargar {{n}} anteriores',
  'reader.continues': 'Continúa…',
  'reader.font_size': 'Tamaño',
  'reader.font': 'Fuente',
  'reader.theme': 'Tema',
  'common.back': 'Volver',
  'common.loading': 'Cargando…',
  'about.title': 'Acerca de',
  'about.lede':
    'Proyecto para facilitar el acceso a los documentos publicados por la Santa Sede.',
  'settings.narrator': 'Narrador',
  'settings.citation_prefix': 'Leer «Cita… Dice»',
  'cover.source': 'Fuente',
};

export function t(key: string, params?: Record<string, string | number>): string {
  let out = ES[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return out;
}

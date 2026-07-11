// Documentos Vaticanos — catálogo de documentos.
// Este módulo es la fuente de datos compartida entre la web y la app Android (Capacitor).
// Reemplazar los bloques marcados [TEXTO PENDIENTE] con el texto íntegro de cada documento.

export const DOCUMENTOS = [
  {
    id: "catecismo",
    titulo: "Catecismo de la Iglesia Católica",
    subtitulo: "Carta apostólica « Laetamur Magnopere »",
    tipo: "Catecismo",
    autor: "Juan Pablo II",
    anio: 1997,
    bloques: [
      { t: "h", x: "CARTA APOSTÓLICA « LAETAMUR MAGNOPERE »" },
      { t: "sub", x: "por la que se aprueba la edición típica latina del Catecismo de la Iglesia Católica" },
      { t: "p", x: "A los Venerables Hermanos Cardenales, Patriarcas, Arzobispos, Obispos, Presbíteros, Diáconos y demás miembros del Pueblo de Dios" },
      { t: "h", x: "JUAN PABLO II, OBISPO," },
      { t: "h", x: "SIERVO DE LOS SIERVOS DE DIOS PARA PERPETUA MEMORIA" },
      { t: "p", x: "[TEXTO PENDIENTE] Aquí se carga el texto completo del documento. Sustituya este bloque por el contenido íntegro en formato de párrafos." }
    ]
  },
  {
    id: "dei-verbum",
    titulo: "Dei Verbum",
    subtitulo: "Constitución dogmática sobre la divina revelación",
    tipo: "Concilio Vaticano II",
    autor: "Pablo VI",
    anio: 1965,
    bloques: [
      { t: "h", x: "DEI VERBUM" },
      { t: "sub", x: "Constitución dogmática sobre la divina revelación" },
      { t: "p", x: "[TEXTO PENDIENTE] Sustituya este bloque por el contenido íntegro del documento." }
    ]
  },
  {
    id: "lumen-gentium",
    titulo: "Lumen Gentium",
    subtitulo: "Constitución dogmática sobre la Iglesia",
    tipo: "Concilio Vaticano II",
    autor: "Pablo VI",
    anio: 1964,
    bloques: [
      { t: "h", x: "LUMEN GENTIUM" },
      { t: "sub", x: "Constitución dogmática sobre la Iglesia" },
      { t: "p", x: "[TEXTO PENDIENTE] Sustituya este bloque por el contenido íntegro del documento." }
    ]
  },
  {
    id: "gaudium-et-spes",
    titulo: "Gaudium et Spes",
    subtitulo: "Constitución pastoral sobre la Iglesia en el mundo actual",
    tipo: "Concilio Vaticano II",
    autor: "Pablo VI",
    anio: 1965,
    bloques: [
      { t: "h", x: "GAUDIUM ET SPES" },
      { t: "sub", x: "Constitución pastoral sobre la Iglesia en el mundo actual" },
      { t: "p", x: "[TEXTO PENDIENTE] Sustituya este bloque por el contenido íntegro del documento." }
    ]
  },
  {
    id: "evangelii-gaudium",
    titulo: "Evangelii Gaudium",
    subtitulo: "Exhortación apostólica sobre el anuncio del Evangelio",
    tipo: "Exhortación apostólica",
    autor: "Francisco",
    anio: 2013,
    bloques: [
      { t: "h", x: "EVANGELII GAUDIUM" },
      { t: "sub", x: "Exhortación apostólica sobre el anuncio del Evangelio en el mundo actual" },
      { t: "p", x: "[TEXTO PENDIENTE] Sustituya este bloque por el contenido íntegro del documento." }
    ]
  },
  {
    id: "laudato-si",
    titulo: "Laudato Si'",
    subtitulo: "Carta encíclica sobre el cuidado de la casa común",
    tipo: "Encíclica",
    autor: "Francisco",
    anio: 2015,
    bloques: [
      { t: "h", x: "LAUDATO SI'" },
      { t: "sub", x: "Carta encíclica sobre el cuidado de la casa común" },
      { t: "p", x: "[TEXTO PENDIENTE] Sustituya este bloque por el contenido íntegro del documento." }
    ]
  }
];

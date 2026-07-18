# Plan de Desarrollo: Sistema de Documentos Vaticanos con Chatbot IA

## Visión General
Este proyecto evoluciona de una herramienta de descarga de documentos vaticanos (Biblia y Catecismo) a un sistema integral de webscraping, estructuración de datos, y consulta inteligente mediante IA. El objetivo final es crear una aplicación que permita consultas profundas sobre documentos católicos, sus referencias cruzadas, y citas bíblicas, tanto online como offline.

## Objetivos Generales

### 1. Descarga de Referencias a Otros Documentos Vaticanos
- **Descripción**: Expandir el webscraping actual para seguir automáticamente las hipervínculos en los documentos descargados (Biblia y Catecismo) que apuntan a otros recursos de vatican.va.
- **Alcance**: 
  - Identificar y extraer enlaces internos durante el parsing HTML.
  - Implementar una cola de descarga para documentos relacionados.
  - Evitar duplicados y bucles infinitos.
- **Beneficios**: Construir una base de datos completa de documentos interconectados del Vaticano.

### 2. Estructuración Estandar de Documentos Detectados
- **Descripción**: Crear un formato JSON unificado para todos los documentos descargados, independientemente de su estructura HTML original.
- **Alcance**:
  - Definir un esquema JSON común (e.g., campos como título, contenido, referencias, metadatos).
  - Adaptar parsers para diferentes tipos de documentos (e.g., encíclicas, catecismos, biblias).
  - Incluir metadatos como fecha, autor, tipo de documento.
- **Beneficios**: Permitir consultas uniformes y motor de búsqueda único.

### 3. Chatbot con Ollama para Consultas Profundas
- **Descripción**: Integrar Ollama para crear un chatbot que responda preguntas complejas sobre los documentos, incluyendo referencias bíblicas y contextuales.
- **Alcance**:
  - Entrenar/modelar con los datos JSON estructurados.
  - Implementar consultas que sigan cadenas de referencias (e.g., "¿Qué dice el Catecismo sobre X, y cuáles son las citas bíblicas?").
  - Soporte para consultas en español (idioma principal).
- **Beneficios**: Acceso inteligente y conversacional a conocimientos teológicos.

### 4. Aplicación Web y Móvil para Consultas
- **Descripción**: Desarrollar interfaces para interactuar con el chatbot.
- **Alcance**:
  - **Web App**: Frontend en Angular (ya existente), integrado con el backend del chatbot.
  - **Android App**: Aplicación offline con todos los datos empaquetados.
    - **Investigación**: Evaluar si Ollama puede generar un modelo ejecutable integrable en APK Android (posible con modelos cuantizados y runtime local).
    - Alternativas: Usar APIs locales o modelos ligeros como GPT-2 fine-tuned.
- **Beneficios**: Accesibilidad amplia, incluyendo trabajo sin conexión.

## Estructura del Plan Detallado

### Fase 1: Mejora del Webscraping (Objetivo 1)
- [ ] Refactorizar `GeneralDownload` para soporte genérico de HTML variado.
- [ ] Implementar detector de enlaces y cola de descarga.
- [ ] Agregar configuración por documento (e.g., selectores CSS dinámicos).

### Fase 2: Estandarización de JSON (Objetivo 2)
- [ ] Definir esquema JSON unificado.
- [ ] Actualizar parsers de Biblia y Catecismo.
- [ ] Crear validador de esquema.

### Fase 3: Integración de IA (Objetivo 3)
- [ ] Configurar Ollama con modelos relevantes (e.g., Llama 3 para español).
- [ ] Desarrollar pipeline de ingesta de datos JSON.
- [ ] Implementar lógica de consultas con seguimiento de referencias.

### Fase 4: Desarrollo de Aplicaciones (Objetivo 4)
- [ ] Mejorar frontend web para integración con chatbot.
- [ ] Investigar e implementar app Android offline.
- [ ] Pruebas de usabilidad y rendimiento.

## Riesgos y Consideraciones
- **Escalabilidad**: Webscraping puede generar mucho tráfico; implementar límites y caches.
- **Legal/Etico**: Asegurar compliance con términos de vatican.va.
- **Técnico**: Ollama en Android puede ser desafiante; evaluar alternativas como ONNX Runtime.
- **Idioma**: Enfocarse en español, pero considerar multilingüe.

## Métricas de Éxito
- Número de documentos descargados y estructurados.
- Precisión de respuestas del chatbot.
- Usuarios activos en web/móvil.

Este plan es iterativo; se ajustará basado en prototipos y feedback.

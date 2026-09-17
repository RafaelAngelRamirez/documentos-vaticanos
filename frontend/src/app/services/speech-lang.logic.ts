export function speechLangForDocumentLocale(locale?: string | null): string {
  switch ((locale || '').toLowerCase()) {
    case 'en': return 'en-US';
    case 'zh': return 'zh-CN';
    case 'hi': return 'hi-IN';
    case 'ar': return 'ar-SA';
    case 'la': return 'la';
    default: return 'es-ES';
  }
}

/**
 * Offline historical-context pack types for Angular consumers.
 * Canonical pure logic + types: historical-context-resolve.logic.ts
 * Pipeline twin: scripts-descarga/models/historical-context.model.ts
 */
export {
  CONTEXT_AXES_KEYS,
  CONTEXT_AXIS_LABELS,
  HISTORICAL_CONTEXT_MANIFEST_URL,
} from './historical-context-resolve.logic';
export type {
  AuthorContextProfile,
  ContextAxes,
  ContextReference,
  DocumentContextOverlay,
  HistoricalContextManifest,
  ResolvedHistoricalContext,
  TimelineEntry,
} from './historical-context-resolve.logic';

import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import {
  CONTEXT_AXIS_LABELS,
  ContextReference,
  ResolvedHistoricalContext,
} from 'src/app/core/context/historical-context.models';
import {
  AxisRowForUi,
  axisRowsForUi,
  orderedRefIds,
  resolveRefIds,
  sourceMarkers,
  speakableHistoricalContextChunks,
} from 'src/app/core/context/historical-context-resolve.logic';
import { NarratorService } from 'src/app/services/narrator.service';
import { NarratorPreferencesService } from 'src/app/services/narrator-preferences.service';

/**
 * Bloque reutilizable de contexto histórico (ficha 2A / santoral).
 * Citas densas + voz alta vía NarratorService (mismo motor que el lector).
 */
@Component({
  standalone: true,
  selector: 'app-historical-context-block',
  imports: [CommonModule],
  templateUrl: './historical-context-block.component.html',
  styleUrls: ['./historical-context-block.component.css'],
})
export class HistoricalContextBlockComponent implements OnChanges, OnDestroy {
  @Input() ctx: ResolvedHistoricalContext | null = null;
  @Input() sectionTitle = 'Contexto histórico';
  @Input() compact = false;

  axisRows: AxisRowForUi[] = [];
  refOrder: string[] = [];
  numberedRefs: { n: number; ref: ContextReference }[] = [];
  expanded = false;

  summaryMarkers = '';
  workMarkers = '';
  chronoMarkers = '';
  summarySources: ContextReference[] = [];
  workSources: ContextReference[] = [];
  chronoSources: ContextReference[] = [];

  /** True while NarratorService is reading context chunks. */
  speaking = false;
  private speakGen = 0;
  private speakChunks: string[] = [];

  constructor(
    private readonly narrator: NarratorService,
    private readonly narrPrefs: NarratorPreferencesService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ctx']) {
      void this.stopSpeaking();
      this.rebuild();
      this.expanded = false;
    }
  }

  ngOnDestroy(): void {
    void this.stopSpeaking();
  }

  private rebuild(): void {
    const c = this.ctx;
    if (!c) {
      this.axisRows = [];
      this.refOrder = [];
      this.numberedRefs = [];
      this.summaryMarkers = '';
      this.workMarkers = '';
      this.chronoMarkers = '';
      this.summarySources = [];
      this.workSources = [];
      this.chronoSources = [];
      this.speakChunks = [];
      return;
    }
    this.refOrder = orderedRefIds(c);
    this.axisRows = axisRowsForUi(
      c.axes,
      CONTEXT_AXIS_LABELS,
      c.axisSources,
      c.references,
    );
    this.summaryMarkers = sourceMarkers(c.summaryRefIds, this.refOrder);
    this.workMarkers = sourceMarkers(c.workSummaryRefIds, this.refOrder);
    this.chronoMarkers = sourceMarkers(c.chronologyRefIds, this.refOrder);
    this.summarySources = resolveRefIds(c.summaryRefIds, c.references);
    this.workSources = resolveRefIds(c.workSummaryRefIds, c.references);
    this.chronoSources = resolveRefIds(c.chronologyRefIds, c.references);
    this.speakChunks = speakableHistoricalContextChunks(c, CONTEXT_AXIS_LABELS);

    const byId = new Map(
      (c.references || []).filter((r) => r.id).map((r) => [r.id as string, r]),
    );
    this.numberedRefs = this.refOrder
      .map((id, i) => {
        const ref = byId.get(id);
        return ref ? { n: i + 1, ref } : null;
      })
      .filter((x): x is { n: number; ref: ContextReference } => !!x);
  }

  get hasContent(): boolean {
    if (!this.ctx) return false;
    return !!(
      this.ctx.generalSummary ||
      this.ctx.workSummary ||
      this.ctx.chronologyNote ||
      this.axisRows.length ||
      (this.ctx.references && this.ctx.references.length)
    );
  }

  get canSpeak(): boolean {
    return this.narrator.supported && this.speakChunks.length > 0;
  }

  get listenLabel(): string {
    return this.speaking ? '⏹ Detener' : '▶ Escuchar contexto';
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  /** Toggle in-place narration of context (not the corpus body). */
  async toggleSpeak(event?: Event): Promise<void> {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.speaking) {
      await this.stopSpeaking();
      return;
    }
    if (!this.canSpeak) return;
    // Expand so the user sees what is being read.
    this.expanded = true;
    const gen = ++this.speakGen;
    this.speaking = true;
    const voices = await this.narrator.listVoices('es');
    const savedId = this.narrPrefs.voiceId;
    const voice =
      (savedId && voices.find((v) => v.id === savedId)) || null;
    try {
      for (const chunk of this.speakChunks) {
        if (gen !== this.speakGen) return;
        const ok = await this.narrator.speak(chunk, {
          lang: 'es-ES',
          rate: 1,
          voice,
        });
        if (!ok || gen !== this.speakGen) return;
      }
    } finally {
      if (gen === this.speakGen) {
        this.speaking = false;
      }
    }
  }

  async stopSpeaking(): Promise<void> {
    this.speakGen++;
    this.speaking = false;
    await this.narrator.cancel();
  }

  markersForAxis(row: AxisRowForUi): string {
    return sourceMarkers(row.refIds, this.refOrder);
  }

  timelineMarkers(refIds?: string[]): string {
    return sourceMarkers(refIds, this.refOrder);
  }
}

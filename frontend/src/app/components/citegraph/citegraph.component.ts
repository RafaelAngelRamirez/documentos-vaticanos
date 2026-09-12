import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import type { DocGraphFile } from 'src/app/core/search/topic-pack.models';
import {
  kindLabel,
  visibleSubgraph,
  type VisibleGraph,
} from 'src/app/core/search/doc-graph.logic';

export interface CitegraphSelect {
  kind: 'node' | 'edge';
  documentId?: string;
  fromId?: string;
  toId?: string;
}

@Component({
  standalone: true,
  selector: 'app-citegraph',
  imports: [CommonModule],
  templateUrl: './citegraph.component.html',
  styleUrls: ['./citegraph.component.css'],
})
export class CitegraphComponent implements OnChanges {
  @Input() graph: DocGraphFile | null = null;
  @Input() focusId: string | null = null;
  @Input() kindFilter: string | null = null;
  @Input() query = '';
  @Input() compact = false;
  @Input() cap = 40;

  @Output() select = new EventEmitter<CitegraphSelect>();

  view: VisibleGraph = { nodes: [], links: [] };
  selectedNode: string | null = null;
  selectedEdge: { from: string; to: string } | null = null;

  ngOnChanges(): void {
    this.view = visibleSubgraph(this.graph, {
      focusId: this.focusId,
      kind: this.kindFilter,
      q: this.query,
      cap: this.compact ? 12 : this.cap,
    });
  }

  nodePos(id: string): { x: number; y: number } {
    const n = this.view.nodes.find((x) => x.id === id);
    return n || { x: 0.5, y: 0.5 };
  }

  x(n: { x: number }): number {
    return Math.round(n.x * 1000);
  }

  y(n: { y: number }): number {
    return Math.round(n.y * 640);
  }

  strokeW(w: number): number {
    return Math.max(1.2, Math.min(5, 1 + w * 4));
  }

  kindOf(id: string): string {
    const n = this.view.nodes.find((x) => x.id === id);
    return kindLabel(n?.kind);
  }

  onNode(id: string, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.selectedNode = id;
    this.selectedEdge = null;
    this.select.emit({ kind: 'node', documentId: id });
  }

  onEdge(from: string, to: string, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.selectedEdge = { from, to };
    this.selectedNode = null;
    this.select.emit({ kind: 'edge', fromId: from, toId: to });
  }

  isNodeOn(id: string): boolean {
    return this.selectedNode === id || this.focusId === id;
  }

  isEdgeOn(from: string, to: string): boolean {
    return (
      this.selectedEdge?.from === from && this.selectedEdge?.to === to
    );
  }
}

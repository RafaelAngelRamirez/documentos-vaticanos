export interface ColaDescargaItem {
  url: string;
  depth: number;
  parentUrl?: string;
}

export class ColaDescarga {
  private queue: ColaDescargaItem[] = [];
  private visited: Set<string> = new Set();
  private maxDepth: number;

  constructor(maxDepth: number = 3) {
    this.maxDepth = maxDepth;
  }

  add(url: string, depth: number = 0, parentUrl?: string): void {
    if (!this.visited.has(url) && depth <= this.maxDepth) {
      this.visited.add(url);
      this.queue.push({ url, depth, parentUrl });
    }
  }

  next(): ColaDescargaItem | undefined {
    return this.queue.shift();
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  size(): number {
    return this.queue.length;
  }
}

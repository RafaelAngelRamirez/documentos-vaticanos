export interface DocumentoGenerico {
  url: string;
  title: string;
  content: string;
  metadata: {
    date?: string;
    type?: string;
    author?: string;
  };
  links: string[];
  depth: number;
  parentUrl?: string;
}

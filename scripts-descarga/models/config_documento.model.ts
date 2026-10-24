export interface ConfigDocumento {
  baseUrl: string;
  selectors: {
    content?: string;
    title?: string;
    links?: string; // Selector for links to follow
    nextPage?: string; // Selector for pagination
  };
  linkFilters: {
    includePattern?: RegExp; // e.g., /vatican\.va/
    excludePattern?: RegExp;
  };
  maxDepth: number;
  documentType: string; // e.g., 'bible', 'catechism'
}

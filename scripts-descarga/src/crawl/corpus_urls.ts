/**
 * Load URLs already present in the reading corpus / download registry.
 */
import fs from "fs";
import path from "path";
import { normalizeUrl } from "./normalize";

const REPO = path.resolve(__dirname, "../../..");

export function loadCorpusSourceUrls(): Set<string> {
  const set = new Set<string>();
  const registryPath = path.join(
    REPO,
    "documentos",
    "registry",
    "downloaded-documents.json",
  );
  if (fs.existsSync(registryPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as {
        documents?: Array<{ sourceUrls?: string[] }>;
      };
      for (const d of reg.documents || []) {
        for (const u of d.sourceUrls || []) {
          set.add(normalizeUrl(u));
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Manifest sourceUrls
  const manifestPath = path.join(REPO, "documentos", "corpus", "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const man = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
        documents?: Array<{ sourceUrl?: string }>;
      };
      for (const d of man.documents || []) {
        if (d.sourceUrl) set.add(normalizeUrl(d.sourceUrl));
      }
    } catch {
      /* ignore */
    }
  }
  return set;
}

/**
 * Fetch + content-hash cache for crawl layer.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import axios from "axios";

export interface FetchResult {
  html: string;
  httpStatus: number;
  contentHash: string;
  fromCache: boolean;
}

export function sha256(buf: string | Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function cachePath(cacheRoot: string, hash: string): string {
  return path.join(cacheRoot, hash.slice(0, 2), `${hash}.html`);
}

export function readCache(cacheRoot: string, hash: string): string | null {
  const p = cachePath(cacheRoot, hash);
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  return null;
}

export function writeCache(cacheRoot: string, hash: string, html: string): void {
  const p = cachePath(cacheRoot, hash);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html, "utf-8");
}

async function fetchWithCurl(url: string): Promise<{ body: Buffer; status: number }> {
  const { execFileSync } = require("child_process") as typeof import("child_process");
  // Use -w for status; body to stdout. Simpler: just body, assume 200 if large.
  const buf = execFileSync(
    "curl",
    [
      "-sL",
      "--max-time",
      "90",
      "-A",
      "Mozilla/5.0 documentos-vaticanos-crawler/0.1",
      "-w",
      "\n__HTTP_STATUS__:%{http_code}",
      url,
    ],
    { maxBuffer: 25 * 1024 * 1024 },
  );
  const text = buf.toString("binary");
  const marker = "\n__HTTP_STATUS__:";
  const idx = text.lastIndexOf(marker);
  let status = 200;
  let bodyBin = text;
  if (idx >= 0) {
    status = parseInt(text.slice(idx + marker.length).trim(), 10) || 200;
    bodyBin = text.slice(0, idx);
  }
  return { body: Buffer.from(bodyBin, "binary"), status };
}

/**
 * Fetch HTML as latin1/utf8 hybrid: prefer latin1 decode for legacy vatican pages.
 */
export async function fetchHtml(
  url: string,
  options?: { cacheRoot?: string; knownHash?: string | null; force?: boolean },
): Promise<FetchResult> {
  const cacheRoot = options?.cacheRoot;
  if (
    !options?.force &&
    options?.knownHash &&
    cacheRoot &&
    fs.existsSync(cachePath(cacheRoot, options.knownHash))
  ) {
    const html = fs.readFileSync(
      cachePath(cacheRoot, options.knownHash),
      "utf-8",
    );
    return {
      html,
      httpStatus: 200,
      contentHash: options.knownHash,
      fromCache: true,
    };
  }

  let body: Buffer;
  let status = 200;
  try {
    const r = await fetchWithCurl(url);
    body = r.body;
    status = r.status;
  } catch {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 90_000,
      maxContentLength: 25 * 1024 * 1024,
      headers: {
        "User-Agent": "Mozilla/5.0 documentos-vaticanos-crawler/0.1",
        Accept: "text/html,application/xhtml+xml",
      },
      validateStatus: () => true,
    });
    body = Buffer.from(res.data);
    status = res.status;
  }

  // Prefer utf-8 if charset meta says so; else latin1 for legacy
  const head = body.slice(0, 2000).toString("latin1");
  const utf8 =
    /charset\s*=\s*["']?utf-8/i.test(head) ||
    /charset=utf-8/i.test(head);
  const html = utf8 ? body.toString("utf-8") : body.toString("latin1");
  const contentHash = sha256(html);

  if (cacheRoot && status >= 200 && status < 400 && html.length > 50) {
    writeCache(cacheRoot, contentHash, html);
  }

  return { html, httpStatus: status, contentHash, fromCache: false };
}

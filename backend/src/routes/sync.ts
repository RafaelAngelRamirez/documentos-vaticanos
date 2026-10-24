import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

/**
 * F9 · Registro = respaldo en nube; merge local→nube al iniciar sesión.
 *
 * POST /api/v1/sync/merge
 * Body: { anotaciones: [...], temas: [...] } — cada ítem con `updatedAt` ISO.
 * Política: upsert por id (anotaciones: PK compuesta userId+id; temas: id o,
 * en su defecto, clave natural ownerId+title) con last-write-wins comparando
 * `updatedAt`. Devuelve el estado consolidado { anotaciones, temas } más un
 * `summary` con contadores para que el cliente sepa si subió algo.
 */
export const syncRouter = Router();

const MAX_ITEMS = 2000;
const ANOTACION_KINDS = ['subrayado', 'nota', 'marcador'] as const;

type InAnotacion = {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel: string | null;
  excerpt: string;
  nota: string | null;
  kind: (typeof ANOTACION_KINDS)[number];
  updatedAt: Date;
};

type InTemaStep = {
  order: number;
  documentId: string;
  unitIndex: number;
  unitLabel: string | null;
  userComment: string | null;
};

type InTema = {
  id: string | null;
  title: string;
  description: string | null;
  coverImageKey: string | null;
  visibility: 'private' | 'unlisted';
  updatedAt: Date;
  steps: InTemaStep[] | null;
};

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function optStr(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseAnotacion(raw: unknown): InAnotacion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r['id'] === 'string' ? r['id'].trim() : '';
  const documentId =
    typeof r['documentId'] === 'string' ? r['documentId'].trim() : '';
  const unitIndex = Number(r['unitIndex']);
  const excerpt = typeof r['excerpt'] === 'string' ? r['excerpt'] : '';
  const kind = r['kind'];
  const updatedAt = parseDate(r['updatedAt']);
  if (
    !id ||
    !documentId ||
    !Number.isInteger(unitIndex) ||
    // Los marcadores (★) no llevan excerpt; subrayados y notas sí.
    (!excerpt && kind !== 'marcador') ||
    !updatedAt ||
    !(ANOTACION_KINDS as readonly unknown[]).includes(kind)
  ) {
    return null;
  }
  return {
    id,
    documentId,
    unitIndex,
    unitLabel: optStr(r['unitLabel']),
    excerpt,
    nota: optStr(r['nota']),
    kind: kind as InAnotacion['kind'],
    updatedAt,
  };
}

function parseTema(raw: unknown): InTema | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r['title'] === 'string' ? r['title'].trim() : '';
  const updatedAt = parseDate(r['updatedAt']);
  if (!title || !updatedAt) return null;

  let steps: InTemaStep[] | null = null;
  if (Array.isArray(r['steps'])) {
    steps = [];
    for (const [i, rawStep] of (r['steps'] as unknown[]).entries()) {
      if (!rawStep || typeof rawStep !== 'object') return null;
      const s = rawStep as Record<string, unknown>;
      const documentId =
        typeof s['documentId'] === 'string' ? s['documentId'].trim() : '';
      const unitIndex = Number(s['unitIndex']);
      if (!documentId || !Number.isInteger(unitIndex)) return null;
      steps.push({
        order: Number.isInteger(Number(s['order'])) ? Number(s['order']) : i,
        documentId,
        unitIndex,
        unitLabel: optStr(s['unitLabel']),
        userComment: optStr(s['userComment']),
      });
    }
  }

  return {
    id: typeof r['id'] === 'string' && r['id'].trim() ? r['id'].trim() : null,
    title,
    description: optStr(r['description']),
    coverImageKey: optStr(r['coverImageKey']),
    // Nunca aceptamos 'public' vía sync: publicar exige pasar por revisión.
    visibility: r['visibility'] === 'unlisted' ? 'unlisted' : 'private',
    updatedAt,
    steps,
  };
}

/** POST /api/v1/sync/merge */
syncRouter.post('/sync/merge', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const rawAnots = Array.isArray(req.body?.anotaciones)
      ? (req.body.anotaciones as unknown[]).slice(0, MAX_ITEMS)
      : [];
    const rawTemas = Array.isArray(req.body?.temas)
      ? (req.body.temas as unknown[]).slice(0, MAX_ITEMS)
      : [];

    const summary = {
      anotacionesCreadas: 0,
      anotacionesActualizadas: 0,
      anotacionesIgnoradas: 0,
      temasCreados: 0,
      temasActualizados: 0,
      temasIgnorados: 0,
    };

    // ── Anotaciones: upsert por (userId, id), last-write-wins ────────────
    const anots = rawAnots
      .map(parseAnotacion)
      .filter((a): a is InAnotacion => a !== null);
    summary.anotacionesIgnoradas = rawAnots.length - anots.length;

    if (anots.length > 0) {
      const existing = await prisma.anotacion.findMany({
        where: { userId, id: { in: anots.map((a) => a.id) } },
        select: { id: true, updatedAt: true },
      });
      const byId = new Map(existing.map((e) => [e.id, e.updatedAt]));

      for (const a of anots) {
        const prevUpdatedAt = byId.get(a.id);
        if (prevUpdatedAt === undefined) {
          await prisma.anotacion.create({ data: { userId, ...a } });
          summary.anotacionesCreadas += 1;
        } else if (a.updatedAt.getTime() > prevUpdatedAt.getTime()) {
          await prisma.anotacion.update({
            where: { userId_id: { userId, id: a.id } },
            data: {
              documentId: a.documentId,
              unitIndex: a.unitIndex,
              unitLabel: a.unitLabel,
              excerpt: a.excerpt,
              nota: a.nota,
              kind: a.kind,
              updatedAt: a.updatedAt,
            },
          });
          summary.anotacionesActualizadas += 1;
        }
        // Igual o más antigua que la nube → gana la nube (no-op).
      }
    }

    // ── Temas: upsert por id (o clave natural ownerId+title), LWW ───────
    const temas = rawTemas
      .map(parseTema)
      .filter((t): t is InTema => t !== null);
    summary.temasIgnorados = rawTemas.length - temas.length;

    for (const t of temas) {
      let existing = t.id
        ? await prisma.theme.findFirst({
            where: { id: t.id, ownerId: userId },
          })
        : null;
      if (!existing) {
        existing = await prisma.theme.findFirst({
          where: { ownerId: userId, title: t.title },
        });
      }

      if (!existing) {
        await prisma.theme.create({
          data: {
            ownerId: userId,
            title: t.title,
            description: t.description,
            coverImageKey: t.coverImageKey,
            visibility: t.visibility,
            steps: t.steps
              ? {
                  create: t.steps.map((s) => ({
                    order: s.order,
                    documentId: s.documentId,
                    unitIndex: s.unitIndex,
                    unitLabel: s.unitLabel,
                    userComment: s.userComment,
                  })),
                }
              : undefined,
          },
        });
        summary.temasCreados += 1;
      } else if (t.updatedAt.getTime() > existing.updatedAt.getTime()) {
        await prisma.theme.update({
          where: { id: existing.id },
          data: {
            title: t.title,
            description: t.description ?? existing.description,
            coverImageKey: t.coverImageKey ?? existing.coverImageKey,
            // La visibilidad/revisión no se degrada desde sync salvo que el
            // tema siga privado/unlisted; 'public' y su cola no se tocan.
            ...(existing.visibility !== 'public'
              ? { visibility: t.visibility }
              : {}),
          },
        });
        if (t.steps) {
          await prisma.themeStep.deleteMany({
            where: { themeId: existing.id },
          });
          if (t.steps.length > 0) {
            await prisma.themeStep.createMany({
              data: t.steps.map((s) => ({
                themeId: existing!.id,
                order: s.order,
                documentId: s.documentId,
                unitIndex: s.unitIndex,
                unitLabel: s.unitLabel,
                userComment: s.userComment,
              })),
            });
          }
        }
        summary.temasActualizados += 1;
      }
      // Igual o más antiguo que la nube → gana la nube (no-op).
    }

    // ── Estado consolidado ───────────────────────────────────────────────
    const [anotaciones, temasFinales] = await Promise.all([
      prisma.anotacion.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.theme.findMany({
        where: { ownerId: userId },
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    res.json({ anotaciones, temas: temasFinales, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Merge failed';
    res.status(500).json({ error: message });
  }
});

import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

export const themesRouter = Router();

const REVIEW_STATUSES = [
  'none',
  'pending',
  'approved',
  'changes',
  'rejected',
] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

function isReviewStatus(v: unknown): v is ReviewStatus {
  return typeof v === 'string' && (REVIEW_STATUSES as readonly string[]).includes(v);
}

/** GET /api/v1/me/themes */
themesRouter.get('/me/themes', requireAuth, async (req, res) => {
  try {
    const items = await prisma.theme.findMany({
      where: { ownerId: req.user!.id },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'List failed';
    res.status(500).json({ error: message });
  }
});

/** GET /api/v1/me/themes/:id */
themesRouter.get('/me/themes/:id', requireAuth, async (req, res) => {
  try {
    const item = await prisma.theme.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!item) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Load failed';
    res.status(500).json({ error: message });
  }
});

/** POST /api/v1/me/themes */
themesRouter.post('/me/themes', requireAuth, async (req, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    const description =
      typeof req.body?.description === 'string' ? req.body.description : undefined;
    const coverImageKey =
      typeof req.body?.coverImageKey === 'string' ? req.body.coverImageKey : undefined;
    const visibility = ['private', 'unlisted', 'public'].includes(req.body?.visibility)
      ? req.body.visibility
      : 'private';

    const wantsPublic = visibility === 'public';
    const item = await prisma.theme.create({
      data: {
        ownerId: req.user!.id,
        title,
        description,
        coverImageKey,
        visibility: wantsPublic ? 'public' : visibility,
        reviewStatus: wantsPublic ? 'pending' : 'none',
        submittedAt: wantsPublic ? new Date() : null,
      },
      include: { steps: true },
    });
    res.status(201).json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed';
    res.status(500).json({ error: message });
  }
});

/** PATCH /api/v1/me/themes/:id */
themesRouter.patch('/me/themes/:id', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.theme.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (typeof req.body?.title === 'string' && req.body.title.trim()) {
      data.title = req.body.title.trim();
    }
    if (typeof req.body?.description === 'string') {
      data.description = req.body.description;
    }
    if (typeof req.body?.coverImageKey === 'string') {
      data.coverImageKey = req.body.coverImageKey;
    }
    if (['private', 'unlisted', 'public'].includes(req.body?.visibility)) {
      data.visibility = req.body.visibility;
      // Public requires review; private/unlisted clear the queue.
      if (req.body.visibility === 'public') {
        if (existing.reviewStatus !== 'approved' && existing.reviewStatus !== 'pending') {
          data.reviewStatus = 'pending';
          data.submittedAt = new Date();
          data.reviewNote = null;
          data.reviewedAt = null;
        }
      } else if (req.body.visibility === 'private') {
        data.reviewStatus = 'none';
        data.submittedAt = null;
        data.reviewedAt = null;
        data.reviewNote = null;
      }
    }

    const item = await prisma.theme.update({
      where: { id: existing.id },
      data,
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/me/themes/:id/submit
 * Mark theme public and send to review queue (4D).
 */
themesRouter.post('/me/themes/:id/submit', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.theme.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
      include: { steps: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (!existing.steps.length) {
      res.status(400).json({ error: 'Añada al menos un pasaje antes de enviar' });
      return;
    }
    if (existing.reviewStatus === 'pending') {
      res.status(400).json({ error: 'Ya está en revisión' });
      return;
    }

    const item = await prisma.theme.update({
      where: { id: existing.id },
      data: {
        visibility: 'public',
        reviewStatus: 'pending',
        submittedAt: new Date(),
        reviewNote: null,
        reviewedAt: null,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Submit failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/me/themes/:id/make-private
 * Keep as private after changes request (6B).
 */
themesRouter.post('/me/themes/:id/make-private', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.theme.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const item = await prisma.theme.update({
      where: { id: existing.id },
      data: {
        visibility: 'private',
        reviewStatus: 'none',
        submittedAt: null,
        reviewedAt: null,
        reviewNote: null,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/me/themes/:id/download
 * Increment download counter (4C community download).
 */
themesRouter.post('/me/themes/:id/download', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.theme.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { ownerId: req.user!.id },
          { reviewStatus: 'approved', visibility: 'public' },
        ],
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const item = await prisma.theme.update({
      where: { id: existing.id },
      data: { downloads: { increment: 1 } },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed';
    res.status(500).json({ error: message });
  }
});

/** DELETE /api/v1/me/themes/:id */
themesRouter.delete('/me/themes/:id', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.theme.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await prisma.theme.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/v1/me/themes/:id/steps
 * Body: { steps: [{ documentId, unitIndex, unitLabel?, userComment? }] }
 * Replaces all steps in order.
 */
themesRouter.put('/me/themes/:id/steps', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.theme.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const rawSteps = Array.isArray(req.body?.steps) ? req.body.steps : null;
    if (!rawSteps) {
      res.status(400).json({ error: 'steps array required' });
      return;
    }

    const steps = rawSteps.map((s: Record<string, unknown>, i: number) => {
      const documentId = String(s.documentId ?? '').trim();
      const unitIndex = Number(s.unitIndex);
      if (!documentId || !Number.isInteger(unitIndex) || unitIndex < 0) {
        throw new Error(`Invalid step at index ${i}`);
      }
      return {
        order: i,
        documentId,
        unitIndex,
        unitLabel: typeof s.unitLabel === 'string' ? s.unitLabel : undefined,
        userComment: typeof s.userComment === 'string' ? s.userComment : undefined,
      };
    });

    await prisma.$transaction([
      prisma.themeStep.deleteMany({ where: { themeId: existing.id } }),
      prisma.themeStep.createMany({
        data: steps.map(
          (s: {
            order: number;
            documentId: string;
            unitIndex: number;
            unitLabel?: string;
            userComment?: string;
          }) => ({
            themeId: existing.id,
            ...s,
          }),
        ),
      }),
    ]);

    // Editing after approval/changes puts it back to draft-like if still public intent.
    // Keep status; owner must re-submit explicitly via /submit.

    const item = await prisma.theme.findUnique({
      where: { id: existing.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    res.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Steps update failed';
    res.status(400).json({ error: message });
  }
});

// ── Admin review queue (6C · 6D) ──────────────────────────────────────────

/**
 * GET /api/v1/admin/themes?status=pending|changes|approved|rejected
 */
themesRouter.get(
  '/admin/themes',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const statusParam = typeof req.query.status === 'string' ? req.query.status : 'pending';
      const where =
        statusParam === 'all'
          ? { visibility: 'public' as const, reviewStatus: { not: 'none' } }
          : isReviewStatus(statusParam) && statusParam !== 'none'
            ? { visibility: 'public' as const, reviewStatus: statusParam }
            : { visibility: 'public' as const, reviewStatus: 'pending' };

      const items = await prisma.theme.findMany({
        where,
        include: {
          steps: { orderBy: { order: 'asc' } },
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ submittedAt: 'asc' }, { updatedAt: 'desc' }],
      });

      const counts = await prisma.theme.groupBy({
        by: ['reviewStatus'],
        where: { visibility: 'public', reviewStatus: { not: 'none' } },
        _count: { _all: true },
      });
      const countMap: Record<string, number> = {};
      for (const c of counts) {
        countMap[c.reviewStatus] = c._count._all;
      }

      res.json({ items, counts: countMap });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Admin list failed';
      res.status(500).json({ error: message });
    }
  },
);

/** GET /api/v1/admin/themes/:id */
themesRouter.get(
  '/admin/themes/:id',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const item = await prisma.theme.findFirst({
        where: { id: req.params.id },
        include: {
          steps: { orderBy: { order: 'asc' } },
          owner: { select: { id: true, name: true, email: true } },
        },
      });
      if (!item) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ item });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Load failed';
      res.status(500).json({ error: message });
    }
  },
);

/**
 * POST /api/v1/admin/themes/:id/review
 * Body: { decision: 'approved' | 'changes' | 'rejected', note?: string }
 */
themesRouter.post(
  '/admin/themes/:id/review',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const decision = String(req.body?.decision ?? '').trim();
      if (!['approved', 'changes', 'rejected'].includes(decision)) {
        res.status(400).json({
          error: 'decision must be approved | changes | rejected',
        });
        return;
      }
      const note =
        typeof req.body?.note === 'string' && req.body.note.trim()
          ? req.body.note.trim()
          : null;

      if ((decision === 'changes' || decision === 'rejected') && !note) {
        res.status(400).json({
          error: 'note is required when requesting changes or rejecting',
        });
        return;
      }

      const existing = await prisma.theme.findFirst({
        where: { id: req.params.id },
      });
      if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (existing.reviewStatus === 'none' || existing.visibility === 'private') {
        res.status(400).json({ error: 'Theme is not in the review queue' });
        return;
      }

      const item = await prisma.theme.update({
        where: { id: existing.id },
        data: {
          reviewStatus: decision,
          reviewNote: note,
          reviewedAt: new Date(),
          // Keep public even if rejected so author sees history; they can make-private.
        },
        include: {
          steps: { orderBy: { order: 'asc' } },
          owner: { select: { id: true, name: true, email: true } },
        },
      });
      res.json({ item });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review failed';
      res.status(500).json({ error: message });
    }
  },
);

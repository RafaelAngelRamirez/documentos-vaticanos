import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

export const themesRouter = Router();

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

    const item = await prisma.theme.create({
      data: {
        ownerId: req.user!.id,
        title,
        description,
        coverImageKey,
        visibility,
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
        data: steps.map((s: {
          order: number;
          documentId: string;
          unitIndex: number;
          unitLabel?: string;
          userComment?: string;
        }) => ({
          themeId: existing.id,
          ...s,
        })),
      }),
    ]);

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

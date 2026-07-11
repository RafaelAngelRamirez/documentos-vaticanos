import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

export const referencesRouter = Router();

/** GET /api/v1/me/references */
referencesRouter.get('/me/references', requireAuth, async (req, res) => {
  try {
    const items = await prisma.personalReference.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'List failed';
    res.status(500).json({ error: message });
  }
});

/** POST /api/v1/me/references */
referencesRouter.post('/me/references', requireAuth, async (req, res) => {
  try {
    const documentId = String(req.body?.documentId ?? '').trim();
    const unitIndex = Number(req.body?.unitIndex);
    const unitLabel =
      typeof req.body?.unitLabel === 'string' ? req.body.unitLabel.trim() : undefined;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map(String).slice(0, 20)
      : [];

    if (!documentId || !/^[a-z0-9-]+$/i.test(documentId)) {
      res.status(400).json({ error: 'documentId invalid' });
      return;
    }
    if (!Number.isInteger(unitIndex) || unitIndex < 0) {
      res.status(400).json({ error: 'unitIndex must be a non-negative integer' });
      return;
    }

    const item = await prisma.personalReference.upsert({
      where: {
        userId_documentId_unitIndex: {
          userId: req.user!.id,
          documentId,
          unitIndex,
        },
      },
      create: {
        userId: req.user!.id,
        documentId,
        unitIndex,
        unitLabel,
        note,
        tags,
      },
      update: {
        unitLabel: unitLabel ?? undefined,
        note: note ?? undefined,
        tags: tags.length ? tags : undefined,
      },
    });
    res.status(201).json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed';
    res.status(500).json({ error: message });
  }
});

/** DELETE /api/v1/me/references/:id */
referencesRouter.delete('/me/references/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await prisma.personalReference.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await prisma.personalReference.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    res.status(500).json({ error: message });
  }
});

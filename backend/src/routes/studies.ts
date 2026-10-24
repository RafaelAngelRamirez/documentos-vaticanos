import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

export const studiesRouter = Router();

function mapStudy(s: {
  id: string;
  teacherId: string;
  title: string;
  description: string | null;
  coverImageKey: string | null;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps?: unknown[];
  teacher?: { id: string; name: string; email: string; pictureUrl: string | null };
  _count?: { enrollments: number };
}) {
  return {
    ...s,
    coverImageUrl: s.coverImageKey ? `/uploads/${s.coverImageKey}` : null,
  };
}

/** GET /api/v1/studies — published catalog */
studiesRouter.get('/studies', async (req, res) => {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 100);
    const skip = Math.max(Number(req.query.offset) || 0, 0);
    const items = await prisma.study.findMany({
      where: { status: 'published' },
      include: {
        steps: { orderBy: { order: 'asc' } },
        teacher: {
          select: { id: true, name: true, email: true, pictureUrl: true },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take,
      skip,
    });
    res.json({ items: items.map(mapStudy) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'List failed';
    res.status(500).json({ error: message });
  }
});

/** GET /api/v1/studies/:id — published for all; drafts only for owner */
studiesRouter.get('/studies/:id', async (req, res) => {
  try {
    const item = await prisma.study.findUnique({
      where: { id: req.params.id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        teacher: {
          select: { id: true, name: true, email: true, pictureUrl: true },
        },
        _count: { select: { enrollments: true } },
      },
    });
    if (!item) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (item.status !== 'published') {
      // optional auth check via header
      const header = req.headers.authorization;
      let owner = false;
      if (header?.startsWith('Bearer ')) {
        try {
          const { verifyAccessToken } = await import('../services/jwt');
          const claims = await verifyAccessToken(header.slice(7).trim());
          owner = claims.sub === item.teacherId;
        } catch {
          owner = false;
        }
      }
      if (!owner) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
    }
    res.json({ item: mapStudy(item) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Load failed';
    res.status(500).json({ error: message });
  }
});

/** GET /api/v1/me/studies — teacher's own studies */
studiesRouter.get(
  '/me/studies',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const items = await prisma.study.findMany({
        where: { teacherId: req.user!.id },
        include: {
          steps: { orderBy: { order: 'asc' } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      res.json({ items: items.map(mapStudy) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'List failed';
      res.status(500).json({ error: message });
    }
  },
);

/** POST /api/v1/studies — create draft (teacher) */
studiesRouter.post(
  '/studies',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const title = String(req.body?.title ?? '').trim();
      if (!title) {
        res.status(400).json({ error: 'title is required' });
        return;
      }
      const description =
        typeof req.body?.description === 'string' ? req.body.description : undefined;
      const coverImageKey =
        typeof req.body?.coverImageKey === 'string'
          ? req.body.coverImageKey
          : undefined;

      const item = await prisma.study.create({
        data: {
          teacherId: req.user!.id,
          title,
          description,
          coverImageKey,
          status: 'draft',
        },
        include: { steps: true, _count: { select: { enrollments: true } } },
      });
      res.status(201).json({ item: mapStudy(item) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Create failed';
      res.status(500).json({ error: message });
    }
  },
);

/** PATCH /api/v1/studies/:id */
studiesRouter.patch('/studies/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const existing = await prisma.study.findFirst({
      where: { id: req.params.id, teacherId: req.user!.id },
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
    const item = await prisma.study.update({
      where: { id: existing.id },
      data,
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json({ item: mapStudy(item) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    res.status(500).json({ error: message });
  }
});

/** PUT /api/v1/studies/:id/steps */
studiesRouter.put(
  '/studies/:id/steps',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const existing = await prisma.study.findFirst({
        where: { id: req.params.id, teacherId: req.user!.id },
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
          teacherNote:
            typeof s.teacherNote === 'string' ? s.teacherNote : undefined,
        };
      });

      await prisma.$transaction([
        prisma.studyStep.deleteMany({ where: { studyId: existing.id } }),
        prisma.studyStep.createMany({
          data: steps.map(
            (s: {
              order: number;
              documentId: string;
              unitIndex: number;
              unitLabel?: string;
              teacherNote?: string;
            }) => ({ studyId: existing.id, ...s }),
          ),
        }),
      ]);

      const item = await prisma.study.findUnique({
        where: { id: existing.id },
        include: {
          steps: { orderBy: { order: 'asc' } },
          _count: { select: { enrollments: true } },
        },
      });
      res.json({ item: mapStudy(item!) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Steps update failed';
      res.status(400).json({ error: message });
    }
  },
);

/** POST /api/v1/studies/:id/publish */
studiesRouter.post(
  '/studies/:id/publish',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const existing = await prisma.study.findFirst({
        where: { id: req.params.id, teacherId: req.user!.id },
        include: { steps: true },
      });
      if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (!existing.steps.length) {
        res.status(400).json({ error: 'Add at least one step before publishing' });
        return;
      }
      const item = await prisma.study.update({
        where: { id: existing.id },
        data: { status: 'published', publishedAt: new Date() },
        include: {
          steps: { orderBy: { order: 'asc' } },
          _count: { select: { enrollments: true } },
        },
      });
      res.json({ item: mapStudy(item) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      res.status(500).json({ error: message });
    }
  },
);

/** POST /api/v1/studies/:id/archive */
studiesRouter.post(
  '/studies/:id/archive',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const existing = await prisma.study.findFirst({
        where: { id: req.params.id, teacherId: req.user!.id },
      });
      if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const item = await prisma.study.update({
        where: { id: existing.id },
        data: { status: 'archived' },
        include: {
          steps: { orderBy: { order: 'asc' } },
          _count: { select: { enrollments: true } },
        },
      });
      res.json({ item: mapStudy(item) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Archive failed';
      res.status(500).json({ error: message });
    }
  },
);

/** DELETE /api/v1/studies/:id */
studiesRouter.delete(
  '/studies/:id',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const existing = await prisma.study.findFirst({
        where: { id: req.params.id, teacherId: req.user!.id },
      });
      if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      await prisma.study.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      res.status(500).json({ error: message });
    }
  },
);

/** POST /api/v1/studies/:id/enroll — student joins published study */
studiesRouter.post('/studies/:id/enroll', requireAuth, async (req, res) => {
  try {
    const study = await prisma.study.findUnique({ where: { id: req.params.id } });
    if (!study || study.status !== 'published') {
      res.status(404).json({ error: 'Study not available' });
      return;
    }
    if (study.teacherId === req.user!.id) {
      res.status(400).json({ error: 'Teachers cannot enroll in their own study' });
      return;
    }
    const enrollment = await prisma.enrollment.upsert({
      where: {
        studyId_studentId: {
          studyId: study.id,
          studentId: req.user!.id,
        },
      },
      create: {
        studyId: study.id,
        studentId: req.user!.id,
        status: 'active',
      },
      update: { status: 'active' },
    });
    res.status(201).json({ enrollment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enroll failed';
    res.status(500).json({ error: message });
  }
});

/** GET /api/v1/me/enrollments */
studiesRouter.get('/me/enrollments', requireAuth, async (req, res) => {
  try {
    const items = await prisma.enrollment.findMany({
      where: { studentId: req.user!.id, status: 'active' },
      include: {
        study: {
          include: {
            steps: { orderBy: { order: 'asc' } },
            teacher: {
              select: { id: true, name: true, email: true, pictureUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: items.map((e) => ({
        ...e,
        study: e.study ? mapStudy(e.study) : e.study,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'List failed';
    res.status(500).json({ error: message });
  }
});

/** GET /api/v1/studies/:id/students — teacher only */
studiesRouter.get(
  '/studies/:id/students',
  requireAuth,
  requireRole('teacher'),
  async (req, res) => {
    try {
      const study = await prisma.study.findFirst({
        where: { id: req.params.id, teacherId: req.user!.id },
      });
      if (!study) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const items = await prisma.enrollment.findMany({
        where: { studyId: study.id, status: 'active' },
        include: {
          student: {
            select: { id: true, name: true, email: true, pictureUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'List failed';
      res.status(500).json({ error: message });
    }
  },
);

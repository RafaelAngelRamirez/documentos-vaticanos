import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { publicUser, signAccessToken } from '../services/jwt';

export const meRouter = Router();

/** GET /api/v1/me */
meRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profile';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/v1/upgrade-teacher
 * Reader → teacher (no payment in v2.0)
 */
meRouter.post('/upgrade-teacher', requireAuth, async (req, res) => {
  try {
    const current = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!current) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (current.role === 'teacher') {
      res.json({
        user: publicUser(current),
        alreadyTeacher: true,
      });
      return;
    }

    const user = await prisma.user.update({
      where: { id: current.id },
      data: {
        role: 'teacher',
        teacherSince: new Date(),
      },
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      user: publicUser(user),
      accessToken,
      alreadyTeacher: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upgrade failed';
    res.status(500).json({ error: message });
  }
});

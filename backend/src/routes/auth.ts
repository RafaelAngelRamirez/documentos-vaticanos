import { Router } from 'express';
import { prisma } from '../db';
import { verifyGoogleIdToken } from '../services/googleAuth';
import {
  issueRefreshToken,
  publicUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '../services/jwt';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

/**
 * POST /api/v1/auth/google
 * Body: { idToken: string }
 * - DEV_AUTH_BYPASS: idToken "dev:email" or "dev:email:Name" (local only)
 * - else: Google idToken verify
 */
authRouter.post('/auth/google', async (req, res) => {
  try {
    const idToken = req.body?.idToken;
    if (typeof idToken !== 'string' || !idToken.trim()) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }

    const identity = await verifyGoogleIdToken(idToken.trim());

    const user = await prisma.user.upsert({
      where: { googleSub: identity.googleSub },
      create: {
        googleSub: identity.googleSub,
        email: identity.email,
        name: identity.name,
        pictureUrl: identity.pictureUrl,
        role: 'reader',
      },
      update: {
        email: identity.email,
        name: identity.name,
        pictureUrl: identity.pictureUrl ?? undefined,
      },
    });

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await issueRefreshToken(user.id);

    res.json({
      accessToken,
      refreshToken,
      user: publicUser(user),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auth failed';
    res.status(401).json({ error: message });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken: string }
 */
authRouter.post('/auth/refresh', async (req, res) => {
  try {
    const raw = req.body?.refreshToken;
    if (typeof raw !== 'string' || !raw.trim()) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    const rotated = await rotateRefreshToken(raw.trim());
    if (!rotated) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const accessToken = await signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      accessToken,
      refreshToken: rotated.newRefreshToken,
      user: publicUser(user),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refresh failed';
    res.status(401).json({ error: message });
  }
});

/**
 * POST /api/v1/auth/logout
 * Body: { refreshToken?: string }
 */
authRouter.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    const raw = req.body?.refreshToken;
    if (typeof raw === 'string' && raw.trim()) {
      await revokeRefreshToken(raw.trim());
    }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Logout failed';
    res.status(500).json({ error: message });
  }
});

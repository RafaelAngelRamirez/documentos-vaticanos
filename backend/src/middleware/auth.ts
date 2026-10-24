import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../services/jwt';
import { prisma } from '../db';

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }

    const claims = await verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

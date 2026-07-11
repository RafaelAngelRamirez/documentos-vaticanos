import { createHash, randomBytes } from 'crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Role } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../db';

export type AccessTokenClaims = {
  sub: string;
  email: string;
  role: Role;
};

const secretKey = () => new TextEncoder().encode(config.jwtSecret);

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    email: claims.email,
    role: claims.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(config.jwtAccessTtl)
    .sign(secretKey());
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims & JWTPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  if (!payload.sub || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
    throw new Error('Invalid access token claims');
  }
  return {
    ...payload,
    sub: payload.sub,
    email: payload.email,
    role: payload.role as Role,
  };
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  const expiresAt = new Date(
    Date.now() + config.jwtRefreshTtlDays * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt,
    },
  });

  return raw;
}

export async function rotateRefreshToken(
  rawRefresh: string,
): Promise<{ userId: string; newRefreshToken: string } | null> {
  const tokenHash = hashToken(rawRefresh);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash },
  });

  if (!existing || existing.expiresAt.getTime() < Date.now()) {
    if (existing) {
      await prisma.refreshToken.delete({ where: { id: existing.id } }).catch(() => undefined);
    }
    return null;
  }

  await prisma.refreshToken.delete({ where: { id: existing.id } });
  const newRefreshToken = await issueRefreshToken(existing.userId);
  return { userId: existing.userId, newRefreshToken };
}

export async function revokeRefreshToken(rawRefresh: string): Promise<void> {
  const tokenHash = hashToken(rawRefresh);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export function publicUser(user: {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: Role;
  teacherSince: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    role: user.role,
    teacherSince: user.teacherSince,
    createdAt: user.createdAt,
  };
}

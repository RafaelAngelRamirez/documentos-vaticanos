import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { config } from '../config';

export type GoogleIdentity = {
  googleSub: string;
  email: string;
  name: string;
  pictureUrl?: string;
};

const client = new OAuth2Client();

/**
 * Local-only bypass: idToken = "dev:email" or "dev:email:Display Name"
 * Enabled only when DEV_AUTH_BYPASS=true and NODE_ENV !== production.
 */
function parseDevToken(idToken: string): GoogleIdentity | null {
  if (!config.devAuthBypass) return null;
  if (!idToken.startsWith('dev:')) return null;

  const rest = idToken.slice('dev:'.length).trim();
  if (!rest) {
    throw new Error(
      'dev token empty; use dev:email@example.com or dev:email@example.com:Name',
    );
  }

  // Optional JSON: dev:{"email":"...","name":"...","sub":"..."}
  if (rest.startsWith('{')) {
    const data = JSON.parse(rest) as {
      email?: string;
      name?: string;
      sub?: string;
      picture?: string;
    };
    if (!data.email) throw new Error('dev JSON token requires email');
    return {
      googleSub: data.sub ?? `dev:${data.email}`,
      email: data.email,
      name: data.name ?? data.email.split('@')[0] ?? 'Dev User',
      pictureUrl: data.picture,
    };
  }

  const [email, ...nameParts] = rest.split(':');
  if (!email || !email.includes('@')) {
    throw new Error('dev token must include a valid email');
  }
  const name = nameParts.join(':').trim() || email.split('@')[0] || 'Dev User';
  return {
    googleSub: `dev:${email}`,
    email,
    name,
    pictureUrl: undefined,
  };
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const dev = parseDevToken(idToken);
  if (dev) return dev;

  if (!config.googleClientIds.length) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: config.googleClientIds,
  });

  const payload = ticket.getPayload() as TokenPayload | undefined;
  if (!payload?.sub || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    pictureUrl: payload.picture,
  };
}

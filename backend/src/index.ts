import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { disconnectDb } from './db';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';
import { healthRouter } from './routes/health';
import { uploadsRouter } from './routes/uploads';
import { referencesRouter } from './routes/references';
import { themesRouter } from './routes/themes';
import { studiesRouter } from './routes/studies';
import { syncRouter } from './routes/sync';

const app = express();

app.use(
  cors({
    origin:
      config.corsOrigin.length === 1 ? config.corsOrigin[0] : config.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}
app.use('/uploads', express.static(config.uploadDir));

const api = express.Router();
api.use(healthRouter);
api.use(authRouter);
api.use(meRouter);
api.use(referencesRouter);
api.use(themesRouter);
api.use(studiesRouter);
api.use(syncRouter);
api.use(uploadsRouter);

app.use('/api/v1', api);

app.get('/', (_req, res) => {
  res.json({
    name: 'documentos-vaticanos-backend',
    docs: '/api/v1/health',
  });
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  },
);

const server = app.listen(config.port, () => {
  console.log(
    `[backend] listening on :${config.port} (cors=${config.corsOrigin}, devAuth=${config.devAuthBypass})`,
  );
  console.log(
    `[backend] uploads → ${path.relative(process.cwd(), config.uploadDir) || config.uploadDir}`,
  );
});

async function shutdown(signal: string) {
  console.log(`[backend] ${signal}, shutting down…`);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

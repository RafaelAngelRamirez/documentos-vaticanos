import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

export const uploadsRouter = Router();

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadMaxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('Only jpeg, png, and webp images are allowed'));
      return;
    }
    cb(null, true);
  },
});

function ensureUploadDir(): void {
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
}

/**
 * POST /api/v1/uploads/image
 * multipart field: "image"
 * sharp: max 1600px, jpeg/webp ~quality 80, strip EXIF
 */
uploadsRouter.post(
  '/uploads/image',
  requireAuth,
  (req, res, next) => {
    upload.single('image')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Field "image" is required' });
        return;
      }

      ensureUploadDir();

      const preferWebp = req.file.mimetype === 'image/webp';
      const ext = preferWebp ? 'webp' : 'jpg';
      const key = `${randomUUID()}.${ext}`;
      const dest = path.join(config.uploadDir, key);

      let pipeline = sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        });

      if (preferWebp) {
        pipeline = pipeline.webp({ quality: 80 });
      } else {
        pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
      }

      const output = await pipeline.toBuffer({ resolveWithObject: true });
      await fs.promises.writeFile(dest, output.data);

      res.status(201).json({
        key,
        url: `/uploads/${key}`,
        width: output.info.width,
        height: output.info.height,
        bytes: output.data.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image processing failed';
      res.status(500).json({ error: message });
    }
  },
);

import { Hono } from 'hono';
import { db } from '../db/index.js';
import { uploadedFiles } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { uploadFile, getPresignedUploadUrl, getPresignedDownloadUrl, deleteFile } from '../lib/file-store.js';
import { validateFileType, analyzeFile } from '../services/file-analysis.js';
import { nanoid } from 'nanoid';

const fileRoutes = new Hono();

// Get pre-signed upload URL (client uploads directly to MinIO)
fileRoutes.post('/presign', async (c) => {
  const userId = c.get('userId' as never) as string;
  const { filename, mimeType, size, cellId } = await c.req.json();

  // Validate file type and size
  const validation = validateFileType(mimeType, size);
  if (!validation.valid) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const storageKey = `${userId}/${nanoid()}/${filename}`;
  const uploadUrl = await getPresignedUploadUrl(storageKey, mimeType);

  // Create DB record
  const [file] = await db.insert(uploadedFiles).values({
    userId,
    cellId: cellId || null,
    filename,
    mimeType,
    sizeBytes: size,
    storageKey,
  }).returning();

  return c.json({
    success: true,
    data: { fileId: file.id, uploadUrl, storageKey },
  });
});

// Direct file upload (multipart form)
fileRoutes.post('/upload', async (c) => {
  const userId = c.get('userId' as never) as string;
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const cellId = formData.get('cellId') as string | null;
  const conversationId = formData.get('conversationId') as string | null;

  if (!file) return c.json({ success: false, error: 'No file provided' }, 400);

  const validation = validateFileType(file.type, file.size);
  if (!validation.valid) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `${userId}/${nanoid()}/${file.name}`;

  await uploadFile(storageKey, buffer, file.type);

  const [record] = await db.insert(uploadedFiles).values({
    userId,
    cellId: cellId || null,
    conversationId: conversationId || null,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    storageKey,
  }).returning();

  return c.json({ success: true, data: record }, 201);
});

// List files
fileRoutes.get('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const cellId = c.req.query('cellId');

  let query = db.select().from(uploadedFiles).where(eq(uploadedFiles.userId, userId));
  const files = await query.orderBy(desc(uploadedFiles.createdAt)).limit(100);
  const filtered = cellId ? files.filter(f => f.cellId === cellId) : files;

  return c.json({ success: true, data: filtered });
});

// Get file metadata
fileRoutes.get('/:id', async (c) => {
  const fileId = c.req.param('id');
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId));
  if (!file) return c.json({ success: false, error: 'File not found' }, 404);
  return c.json({ success: true, data: file });
});

// Get signed download URL
fileRoutes.get('/:id/url', async (c) => {
  const fileId = c.req.param('id');
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId));
  if (!file) return c.json({ success: false, error: 'File not found' }, 404);

  const url = await getPresignedDownloadUrl(file.storageKey);
  return c.json({ success: true, data: { url, expiresIn: 3600 } });
});

// Analyze file with AI
fileRoutes.post('/:id/analyze', async (c) => {
  const fileId = c.req.param('id');
  const { prompt } = await c.req.json();

  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId));
  if (!file) return c.json({ success: false, error: 'File not found' }, 404);

  const result = await analyzeFile(file.storageKey, file.mimeType, file.filename, prompt || 'Summarize this file');

  // Cache the analysis result
  if (result.success) {
    await db.update(uploadedFiles)
      .set({ analysisResult: result })
      .where(eq(uploadedFiles.id, fileId));
  }

  return c.json({ success: true, data: result });
});

// Delete file
fileRoutes.delete('/:id', async (c) => {
  const fileId = c.req.param('id');
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId));
  if (!file) return c.json({ success: false, error: 'File not found' }, 404);

  await deleteFile(file.storageKey);
  await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));
  return c.json({ success: true, data: { deleted: true } });
});

export default fileRoutes;

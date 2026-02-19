import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { uploadedFiles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { uploadFile, getPresignedDownloadUrl, deleteFile, getPresignedUploadUrl } from '../lib/file-store.js';

const fileRoutes = new Hono();

// Request a pre-signed upload URL
fileRoutes.post('/upload', async (c) => {
  const userId = c.get('userId' as never) as string;
  const { filename, mimeType, sizeBytes, cellId } = await c.req.json();

  if (!filename || !mimeType) {
    return c.json({ success: false, error: 'filename and mimeType required' }, 400);
  }

  const storageKey = `${userId}/${nanoid()}/${filename}`;
  const uploadUrl = await getPresignedUploadUrl(storageKey);

  // Save file metadata
  const [file] = await db.insert(uploadedFiles).values({
    userId,
    cellId: cellId || null,
    filename,
    mimeType,
    sizeBytes: sizeBytes || 0,
    storageKey,
  }).returning();

  return c.json({ success: true, data: { fileId: file.id, uploadUrl, storageKey } });
});

// Direct upload (multipart)
fileRoutes.post('/upload/direct', async (c) => {
  const userId = c.get('userId' as never) as string;
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const cellId = formData.get('cellId') as string | null;

  if (!file) {
    return c.json({ success: false, error: 'No file provided' }, 400);
  }

  const storageKey = `${userId}/${nanoid()}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(storageKey, buffer, file.type, buffer.length);

  const [saved] = await db.insert(uploadedFiles).values({
    userId,
    cellId: cellId || null,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: buffer.length,
    storageKey,
  }).returning();

  return c.json({ success: true, data: saved }, 201);
});

// Get file metadata
fileRoutes.get('/:id', async (c) => {
  const fileId = c.req.param('id');
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  if (!file) return c.json({ success: false, error: 'File not found' }, 404);
  return c.json({ success: true, data: file });
});

// Get download URL
fileRoutes.get('/:id/url', async (c) => {
  const fileId = c.req.param('id');
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  if (!file) return c.json({ success: false, error: 'File not found' }, 404);

  const url = await getPresignedDownloadUrl(file.storageKey);
  return c.json({ success: true, data: { url } });
});

// Delete file
fileRoutes.delete('/:id', async (c) => {
  const fileId = c.req.param('id');
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  if (!file) return c.json({ success: false, error: 'File not found' }, 404);

  await deleteFile(file.storageKey);
  await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));
  return c.json({ success: true });
});

export default fileRoutes;

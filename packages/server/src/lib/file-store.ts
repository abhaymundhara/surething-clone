import { Client } from 'minio';

const BUCKET = process.env.MINIO_BUCKET || 'surething-uploads';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'us-east-1');
    console.log(`[MinIO] Created bucket: ${BUCKET}`);
  } else {
    console.log(`[MinIO] Bucket ready: ${BUCKET}`);
  }
}

export async function uploadFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await minioClient.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': contentType,
  });
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const stream = await minioClient.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function getPresignedUploadUrl(key: string, contentType: string, expirySeconds = 3600): Promise<string> {
  // For pre-signed PUT, we use presignedPutObject
  return minioClient.presignedPutObject(BUCKET, key, expirySeconds);
}

export async function getPresignedDownloadUrl(key: string, expirySeconds = 3600): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, key, expirySeconds);
}

export async function deleteFile(key: string): Promise<void> {
  await minioClient.removeObject(BUCKET, key);
}

export async function getFileInfo(key: string): Promise<{ size: number; contentType: string; lastModified: Date } | null> {
  try {
    const stat = await minioClient.statObject(BUCKET, key);
    return {
      size: stat.size,
      contentType: stat.metaData['content-type'] || 'application/octet-stream',
      lastModified: stat.lastModified,
    };
  } catch {
    return null;
  }
}

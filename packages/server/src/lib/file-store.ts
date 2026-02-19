import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'surething_minio',
  secretKey: process.env.MINIO_SECRET_KEY || 'surething_minio_secret',
});

const BUCKET = process.env.MINIO_BUCKET || 'surething-files';

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`[FileStore] Created bucket: ${BUCKET}`);
  }
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string,
  size: number
): Promise<void> {
  await minioClient.putObject(BUCKET, key, buffer, size, {
    'Content-Type': mimeType,
  });
}

export async function getPresignedUploadUrl(
  key: string,
  expirySeconds: number = 3600
): Promise<string> {
  return minioClient.presignedPutObject(BUCKET, key, expirySeconds);
}

export async function getPresignedDownloadUrl(
  key: string,
  expirySeconds: number = 3600
): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, key, expirySeconds);
}

export async function deleteFile(key: string): Promise<void> {
  await minioClient.removeObject(BUCKET, key);
}

export async function getFileStream(key: string) {
  return minioClient.getObject(BUCKET, key);
}

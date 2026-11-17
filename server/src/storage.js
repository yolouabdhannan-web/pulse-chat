import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config.js';

const { s3: c } = config;
const useS3 = Boolean(c.bucket);
const dir = path.resolve('uploads');
const client = useS3
  ? new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      forcePathStyle: Boolean(c.endpoint),
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    })
  : null;

export async function put(key, buffer, mime) {
  if (useS3) {
    await client.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: buffer, ContentType: mime }));
  } else {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), buffer);
  }
}

export async function remove(key) {
  if (useS3) {
    await client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
  } else {
    await fs.rm(path.join(dir, key), { force: true });
  }
}

// Retourne soit { redirect: urlSignée } (S3), soit { path } (disque local)
export async function locate(key) {
  if (useS3) {
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: c.bucket, Key: key }), { expiresIn: 300 });
    return { redirect: url };
  }
  return { path: path.join(dir, key) };
}

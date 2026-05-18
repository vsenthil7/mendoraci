/**
 * S3 / MinIO client helper.
 *
 * Anchors: RT-006 Evidence Export (CP-8); BR-006.
 *
 * MinIO is API-compatible with S3, so we use the official AWS SDK v3 client
 * with `forcePathStyle: true` and a custom endpoint pointing at the MinIO
 * service. Bucket is created at compose-up by the `minio-init` one-shot.
 *
 * Two operations are used by the evidence export route:
 *   - putObjectBytes(): upload a Buffer with a content-type
 *   - getPresignedGetUrl(): mint a short-TTL signed download URL
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  const endpoint = process.env.S3_ENDPOINT ?? 'http://minio:9000';
  const region = process.env.S3_REGION ?? 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY ?? '';
  const secretAccessKey = process.env.S3_SECRET_KEY ?? '';
  _client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export const EVIDENCE_BUCKET = process.env.S3_BUCKET_EVIDENCE ?? 'mendoraci-evidence';

export async function putObjectBytes(args: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType ?? 'application/octet-stream',
      Metadata: args.metadata,
    }),
  );
}

export async function getPresignedGetUrl(args: {
  bucket: string;
  key: string;
  expiresInSeconds: number;
}): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: args.bucket, Key: args.key });
  return getSignedUrl(client(), cmd, { expiresIn: args.expiresInSeconds });
}

/**
 * Returns true if the bucket is reachable. Used by /health and by the
 * evidence-export route to fail fast with 503 if MinIO is down.
 */
export async function isBucketReachable(bucket: string): Promise<boolean> {
  try {
    await client().send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

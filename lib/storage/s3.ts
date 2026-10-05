import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "@/lib/api-error";

/**
 * Neon Object Storage, over the S3-compatible API.
 *
 * Neon injects AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_ENDPOINT_URL_S3 /
 * AWS_REGION when a `buckets` block exists in neon.ts, and the AWS SDK reads those
 * names on its own. Only path-style addressing has to be set: Neon does not do
 * virtual-host buckets.
 *
 * Credentials are branch-scoped, so a preview branch reads and writes its own copy
 * of every object with no environment-specific plumbing here.
 */

export const BUCKETS = {
  attachments: "ims-attachments",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Presigned PUT: the browser uploads the moment the URL is issued. */
const SIGNED_URL_TTL_SECONDS = 300;

/** Presigned GET: an hour, so a link pasted into an email still works later. */
const READ_URL_TTL_SECONDS = 3600;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type UploadSpec = {
  bucket: BucketName;
  /** An allowlist, not a check on a suffix: a route that accepts any type is a file store for malware. */
  contentTypes: readonly string[];
  /** Fallback extension when the filename has none. */
  fallbackExtension: string;
  maxBytes: number;
};

export const UPLOAD_KINDS = {
  "item-photo": {
    bucket: BUCKETS.attachments,
    contentTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"],
    fallbackExtension: "bin",
    maxBytes: 2 * 1024 * 1024,
  },
  "lab-attachment": {
    bucket: BUCKETS.attachments,
    contentTypes: ["application/pdf", "image/png", "image/jpeg"],
    fallbackExtension: "bin",
    maxBytes: MAX_UPLOAD_BYTES,
  },
  "po-document": {
    bucket: BUCKETS.attachments,
    contentTypes: ["application/pdf", "image/png", "image/jpeg"],
    fallbackExtension: "bin",
    maxBytes: MAX_UPLOAD_BYTES,
  },
} as const satisfies Record<string, UploadSpec>;

export type UploadKind = keyof typeof UPLOAD_KINDS;

/** Widened view of the same table: `as const` narrows contentTypes to a tuple of
 * literals, which `includes(string)` cannot be called against. */
const UPLOAD_SPECS: Record<UploadKind, UploadSpec> = UPLOAD_KINDS;

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && Object.hasOwn(UPLOAD_KINDS, value);
}

let cachedClient: S3Client | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );
}

function client(): S3Client {
  if (!cachedClient) {
    if (!isStorageConfigured()) {
      throw new ApiError(
        503,
        "File storage is not configured. Add a `buckets` block to neon.ts, run `neon deploy`, then `neon env pull`.",
      );
    }
    cachedClient = new S3Client({
      forcePathStyle: true,
      region: process.env.AWS_REGION ?? "us-east-2",
    });
  }
  return cachedClient;
}

const RANDOM = () => Math.random().toString(36).slice(2, 10);

function sanitizeExtension(filename: string): string | null {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(filename);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Builds the object key. Never derived from the client's filename: that string is
 * caller-controlled, and `../../` or a `.php` suffix must not reach a storage path
 * or come back out in a response header.
 */
export function buildObjectKey(kind: UploadKind, filename: string): string {
  const extension = sanitizeExtension(filename) ?? UPLOAD_KINDS[kind].fallbackExtension;
  const now = new Date();
  const prefix = `${kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${prefix}/${RANDOM()}-${RANDOM()}.${extension}`;
}

export function assertUploadAllowed(kind: UploadKind, contentType: string, size: number): void {
  const spec = UPLOAD_SPECS[kind];
  if (!spec.contentTypes.includes(contentType)) {
    throw new ApiError(415, `Unsupported content type: ${contentType}`);
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new ApiError(422, "File is empty");
  }
  if (size > spec.maxBytes) {
    throw new ApiError(413, `File is larger than the ${Math.floor(spec.maxBytes / (1024 * 1024))} MB limit`);
  }
}

/**
 * A presigned PUT: the browser streams bytes straight to storage, so a 10 MB
 * attachment never occupies a request body in the Next.js function and never runs
 * into the server-action body limit.
 */
export async function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: BUCKETS.attachments, Key: key, ContentType: contentType }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );
}

export async function presignDownload(key: string): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: BUCKETS.attachments, Key: key }),
    { expiresIn: READ_URL_TTL_SECONDS },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKETS.attachments, Key: key }));
}
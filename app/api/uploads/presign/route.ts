import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import {
  assertUploadAllowed,
  buildObjectKey,
  isUploadKind,
  presignUpload,
  UPLOAD_KINDS,
} from "@/lib/storage/s3";
import type { ModuleKey } from "@/lib/rbac";

/**
 * Which module an upload kind belongs to. The caller cannot pick a bucket or a
 * path: it names the kind, and the kind decides both the bucket and the RBAC
 * check, so there is no way to write into another module's storage.
 */
const KIND_MODULE: Record<string, ModuleKey> = {
  "item-photo": "inventory",
  "lab-attachment": "lab",
  "po-document": "purchasing",
};

const schema = z.object({
  kind: z.string().min(1),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

/**
 * Returns a presigned PUT for one file.
 *
 * Nothing is written to the database here. The caller PUTs the bytes, then saves
 * the returned key on the record that owns them. Two writes, deliberately: a
 * row pointing at a missing object is recoverable, an orphaned object is not.
 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    if (!isUploadKind(body.kind)) {
      return NextResponse.json({ error: "Unknown upload kind" }, { status: 422 });
    }

    const { error } = await requireModuleAccess(KIND_MODULE[body.kind]);
    if (error) return error;

    assertUploadAllowed(body.kind, body.contentType, body.size);

    const key = buildObjectKey(body.kind, body.filename);
    const uploadUrl = await presignUpload(key, body.contentType);

    return NextResponse.json({
      key,
      uploadUrl,
      expiresIn: 300,
      maxBytes: UPLOAD_KINDS[body.kind].maxBytes,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
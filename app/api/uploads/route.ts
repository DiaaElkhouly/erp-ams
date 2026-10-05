import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import { handleApiError } from "@/lib/api-helpers";
import { presignDownload } from "@/lib/storage/s3";

/**
 * Which module may read a given object key.
 *
 * Keys are namespaced by upload kind (`item-photo/...`, `lab-attachment/...`),
 * so this is a prefix match rather than a database lookup: it works for an object
 * that is not yet attached to any row.
 */
const KEY_PREFIX_MODULE: [prefix: string, module: ModuleKey][] = [
  ["item-photo/", "inventory"],
  ["lab-attachment/", "lab"],
  ["po-document/", "purchasing"],
];

function moduleForKey(key: string): ModuleKey | null {
  return KEY_PREFIX_MODULE.find(([prefix]) => key.startsWith(prefix))?.[1] ?? null;
}

/**
 * Streams a stored object through a redirect to a presigned GET.
 *
 * The redirect is what lets `<img src>` and `window.open` work: neither can add
 * an Authorization header, and handing the bucket's credentials to the browser
 * would make every object in the branch world-readable. The signed URL in the
 * redirect expires in an hour, so it is a bearer token for that one object only.
 */
export async function GET(req: NextRequest) {
  try {
    const key = new URL(req.url).searchParams.get("key") ?? "";
    // Reject traversal and absolute-looking keys before they reach the SDK.
    if (!key || key.startsWith("/") || key.includes("..")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 422 });
    }

    const moduleKey = moduleForKey(key);
    if (!moduleKey) {
      return NextResponse.json({ error: "Unknown key" }, { status: 404 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccess(session.user.role, moduleKey)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = await presignDownload(key);
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    return handleApiError(err);
  }
}
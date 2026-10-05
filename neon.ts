import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  buckets: {
    // Single private bucket for every user-attached file: lab test attachments,
    // item photos and purchase-order documents. Keys are namespaced by kind
    // (`item-photo/2026/10/...`), and the RBAC check in app/api/uploads is a
    // prefix match on that namespace.
    //
    // `neon deploy` creates it; `neon env pull` writes the AWS_* credentials.
    "ims-attachments": {},
  },
});
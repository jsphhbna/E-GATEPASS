# Image security and cleanup

Milestone F keeps Cloudinary's API secret and all destructive operations in Netlify Functions. The browser receives only a short-lived upload signature, the public Cloudinary API key, and the exact server-generated public ID it must use. It never receives destructive credentials.

## Identifier and reference policy

- Current uploads use `e-gatepass/photos/<uploadId>` or `e-gatepass/ids/<uploadId>`, where the random upload ID is 16-128 URL-safe characters.
- Older syntactically safe identifiers are treated as legacy candidates. They are usable only when an existing visitor or gate-pass document references the exact value.
- Empty, oversized, traversal-like, or otherwise malformed identifiers are rejected before Cloudinary is contacted.
- A well-formed but unreferenced identifier is not an authorization grant and returns not found.

The `imageUploads` collection is server-only. Each signature creates a 24-hour pending session bound to the authenticated visitor or active Kiosk identity and the exact public ID. Pass creation validates and atomically claims every upload session. Existing pass idempotency remains valid after a session has been claimed.

`imageUploads.expiresAt` remains only the unclaimed-upload deadline. New visitors receive a separate `imagesExpireAt` from the configured image policy. Policy changes do not rewrite existing deadlines. Expired, missing, and temporarily unavailable images have distinct UI states while visitor/pass metadata remains readable.

## Access matrix

| Actor | Pending operational image | Historical referenced image | Arbitrary/unreferenced image | Destructive access |
| --- | --- | --- | --- | --- |
| Guard | Allowed when an exact gate-pass reference is pending | Denied | Denied | None |
| Admin | Allowed | Allowed when exactly referenced by an existing record | Denied | None |
| Super Admin | Allowed | Allowed when exactly referenced by an existing record | Denied | Manual bounded purge only |
| Visitor / Kiosk | No proxy access | No proxy access | No proxy access | Own unclaimed upload cleanup only |

`AuthenticatedImage` sends its Firebase bearer token in an authorization header, reads the response into a temporary browser object URL, verifies that the response is an image, revokes old object URLs, and has no direct-Cloudinary fallback.

## Cleanup paths

Failed pass creation invokes `/api/cleanup-upload`. That endpoint accepts at most the two expected images and deletes only exact, current-format sessions owned by the caller that remain unclaimed. Claimed images cannot be removed through this path. A failed deletion is marked `cleanup_failed` and produces a server-only reconciliation task.

Retention purge is separate. `/api/purge-images` accepts only an authenticated Super Admin or the timing-safe `CRON_SECRET` internal caller. It processes at most 25 eligible visitor records and 25 expired pending uploads per invocation, accepts only `ok` or `not found` from Cloudinary as success, and marks a visitor purged only after all referenced deletions succeed. Partial deletion, cleanup failure, or audit failure creates a reconciliation task and returns explicit partial/reconciliation information.

There is intentionally no generic image DELETE endpoint and no unauthenticated or unrestricted cleanup endpoint. The daily Netlify retention wrapper delegates to the existing `CRON_SECRET`-protected bounded purge; an authorized Super Admin may also run it manually. Required indexes must be deployed before enabling scheduled cleanup.

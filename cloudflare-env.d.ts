declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_EMAILS?: string;
    MP_ACCESS_TOKEN?: string;
    MP_WEBHOOK_SECRET?: string;
    SITE_URL?: string;
  }
}

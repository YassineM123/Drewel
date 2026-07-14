# Backend deployment contract

The API and admin site share `https://admin-dreewel.com`. Production must set:

```dotenv
NODE_ENV=production
PUBLIC_API_URL=https://admin-dreewel.com
TRUST_PROXY_HOPS=1
STORAGE_DRIVER=local
```

Use `TRUST_PROXY_HOPS=1` only when Nginx is the single direct proxy. If the
topology changes, update the hop count instead of enabling an unrestricted
`trust proxy` setting.

For local storage, keep the service account's upload directory writable:

```text
/var/www/drewel-v3/drewel-backend/public
```

The application resolves uploads from the backend root even when launched from
another directory, while the example systemd unit also pins `WorkingDirectory`.

Before restarting, validate references without modifying data:

```bash
npm ci
npm run audit:image-assets
```

The audit exits `2` for missing or invalid managed references. A missing object
cannot be recreated automatically; check previous deployment directories,
buckets, and backups before asking users to upload a replacement.

The Nginx example proxies `/api/` and `/socket.io/` to `127.0.0.1:3001` and
passes the host and scheme. The Node service should remain bound to loopback.


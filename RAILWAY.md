# Deploying to Railway

This project is deployed as four Railway services from the same GitHub
repository: Platform API, ERP API, ERP Web, and Web Store. Create each service
with the repository root (`/`) as its build context and set the Dockerfile path
shown below. Do not use the old single-service configuration.

---

## Prerequisites

- A [Railway](https://railway.app) account
- Your project pushed to a GitHub repository

---

## Step 1 — Create a new Railway project

1. Go to [railway.app/new](https://railway.app/new) and click **Deploy from GitHub repo**
2. Select `boukadaabdelhamid-dot/Midanic-company-`.
3. Add four services from the same repository. For each service, use `/` as
   the Root Directory and the matching Dockerfile path:

   | Service | Dockerfile |
   |---|---|
   | Platform API + Platform Web | `/Dockerfile` |
   | ERP API | `/artifacts/erp-api-server/Dockerfile` |
   | ERP Web | `/artifacts/erp/Dockerfile` |
   | Web Store | `/artifacts/web-store/Dockerfile` |

---

## Step 2 — Add a PostgreSQL database

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**.
2. Share the resulting `DATABASE_URL` with Platform API and ERP API.
3. Platform owns the `public` schema; ERP creates and uses the `erp` schema.

---

## Step 3 — Set environment variables

For **Platform API**, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Disables dev-only seeding and enables static file serving |
| `SESSION_SECRET` | `<random 64-char string>` | Used for JWT signing — generate with `openssl rand -hex 32` |
| `DATABASE_URL` | *(auto-injected by Railway PostgreSQL)* | No action needed if you added the DB add-on |
| `ADMIN_EMAIL` | Your administrator email | Used once to create the first `super_admin` account |
| `ADMIN_PASSWORD` | A strong password (12+ characters) | Used once to create the first `super_admin` account |
| `PLATFORM_SSO_SECRET` | Strong random secret | Shared only with ERP API for SSO tickets |
| `PLATFORM_SERVICE_SECRET` | Strong random secret | Shared only with ERP API for the control bridge |
| `ERP_API_URL` | Public ERP API URL | Used by Platform's Super Admin control bridge |
| `ERP_WEB_URL` | Public ERP Web URL | Used to create SSO launch links |

For **ERP API**, add:

| Variable | Required | Notes |
|---|---:|---|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | Same Railway PostgreSQL URL |
| `SESSION_SECRET` or `JWT_SECRET` | Yes | Strong random secret |
| `ALLOWED_ORIGINS` | Yes | ERP Web and Web Store public URLs, comma-separated |
| `FRONTEND_URL` | Recommended | Public ERP Web URL |
| `WEB_STORE_URL` | Recommended | Public Web Store URL |
| `APP_URL` | Recommended | Public ERP Web URL |
| `PLATFORM_API_URL` | Yes in production | Public Platform API URL |
| `PLATFORM_SSO_SECRET` | Yes | Same value as Platform API |
| `PLATFORM_SERVICE_SECRET` | Yes | Same value as Platform API |

For **ERP Web**, set the Docker build variable:

| Variable | Value |
|---|---|
| `VITE_API_URL` | Public ERP API URL |

For **Web Store**, set:

| Variable | Value |
|---|---|
| `VITE_API_URL` | Public ERP API URL |
| `VITE_STORE_SLUG` | The public store slug, for example `principal` |

> **Tip:** Generate a strong secret with: `openssl rand -hex 32`

On the first production startup, if both `ADMIN_EMAIL` and `ADMIN_PASSWORD` are
present, the API creates that administrator when the email does not exist yet.
If the email already exists, startup synchronizes that account's password,
activates it, and promotes it to `super_admin`. This only happens for the
explicitly configured bootstrap email. After confirming that you can log in,
remove `ADMIN_PASSWORD` from the Railway service variables and redeploy; it is
only needed for first-account bootstrap.

---

## Step 4 — Database initialization

After the first successful deploy, open the service's **Shell** tab and run:

```bash
cd /app
# The migration tool needs the workspace source, so run it locally or via
# a one-off Railway run command:
```

The Platform API applies its bundled migrations during startup. The ERP API
creates and reconciles its `erp` schema during startup. Deploy Platform API
before ERP API on a fresh database, then verify both health checks. Do not run
the old `lib/db` migration command against the ERP schema.

---

## Step 5 — Deploy

Push a commit to your GitHub main branch — Railway will rebuild and redeploy automatically.

The health-check endpoints are:
```
GET /api/healthz   →  { "status": "ok" }
```

The same endpoint is used by both API services.

---

## Environment variable reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | `8080` (Docker default) | Railway injects this automatically |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `NODE_ENV` | Yes | — | Set to `production` |
| `LOG_LEVEL` | No | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |
| `ADMIN_EMAIL` | Only for first bootstrap | — | Email for the initial `super_admin` |
| `ADMIN_PASSWORD` | Only for first bootstrap | — | Initial admin password (12+ characters) |

---

## Local Docker test

To verify the image builds and runs correctly before pushing to Railway:

```bash
# Build
docker build -f Dockerfile -t midanic-platform .
docker build -f artifacts/erp-api-server/Dockerfile -t midanic-erp-api .
docker build -f artifacts/erp/Dockerfile -t midanic-erp-web .
docker build -f artifacts/web-store/Dockerfile -t midanic-store .

# Run (supply your own DATABASE_URL)
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e NODE_ENV=production \
  midanic
```

Open http://localhost:8080 — you should see the Midanic homepage.

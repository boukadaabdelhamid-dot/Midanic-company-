# Deploying to Railway

This project deploys as a **single Railway service** — the Express API server also serves the pre-built React frontend, so both share the same origin and no CORS configuration is needed.

---

## Prerequisites

- A [Railway](https://railway.app) account
- Your project pushed to a GitHub repository

---

## Step 1 — Create a new Railway project

1. Go to [railway.app/new](https://railway.app/new) and click **Deploy from GitHub repo**
2. Select your repository — Railway will detect the `Dockerfile` automatically

---

## Step 2 — Add a PostgreSQL database

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway will provision a Postgres instance and add `DATABASE_URL` to the service's shared variables automatically

---

## Step 3 — Set environment variables

In your service's **Variables** tab, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Disables dev-only seeding and enables static file serving |
| `SESSION_SECRET` | `<random 64-char string>` | Used for JWT signing — generate with `openssl rand -hex 32` |
| `DATABASE_URL` | *(auto-injected by Railway PostgreSQL)* | No action needed if you added the DB add-on |
| `ADMIN_EMAIL` | Your administrator email | Used once to create the first `super_admin` account |
| `ADMIN_PASSWORD` | A strong password (12+ characters) | Used once to create the first `super_admin` account |

> **Tip:** Generate a strong secret with: `openssl rand -hex 32`

On the first production startup, if both `ADMIN_EMAIL` and `ADMIN_PASSWORD` are
present, the API creates that administrator when the email does not exist yet.
If the email already exists, startup synchronizes that account's password,
activates it, and promotes it to `super_admin`. This only happens for the
explicitly configured bootstrap email. After confirming that you can log in,
remove `ADMIN_PASSWORD` from the Railway service variables and redeploy; it is
only needed for first-account bootstrap.

---

## Step 4 — Run database migrations (first deploy only)

After the first successful deploy, open the service's **Shell** tab and run:

```bash
cd /app
# The migration tool needs the workspace source, so run it locally or via
# a one-off Railway run command:
```

Because the Docker image only ships the compiled bundle (not the source), run migrations **before** the first deploy from your local machine or Replit:

```bash
# On Replit / local, with DATABASE_URL set to your Railway Postgres URL:
DATABASE_URL="<your-railway-postgres-url>" pnpm --filter @workspace/db run push
```

You can find the Railway Postgres URL in the database service's **Variables** tab under `DATABASE_URL`.

---

## Step 5 — Deploy

Push a commit to your GitHub main branch — Railway will rebuild and redeploy automatically.

The health-check endpoint is at:
```
GET /api/healthz   →  { "status": "ok" }
```

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
docker build -t midanic .

# Run (supply your own DATABASE_URL)
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e NODE_ENV=production \
  midanic
```

Open http://localhost:8080 — you should see the Midanic homepage.

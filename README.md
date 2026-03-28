# Core Panel — Auth0 Embedded Login Monorepo

A production-ready monorepo with Auth0 embedded login (custom form + TOTP MFA with QR code enrollment) using Next.js 14 frontend and Express.js backend with PostgreSQL.

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | npm workspaces + Turborepo |
| Frontend | Next.js 14 (App Router), TypeScript, MUI v7, Tailwind CSS |
| Backend | Express.js, TypeScript, Drizzle ORM |
| Database | PostgreSQL |
| Auth | Auth0 (Resource Owner Password grant + TOTP MFA) |

---

## Auth0 Dashboard Setup

### 1. Create an Application

1. Go to **Auth0 Dashboard → Applications → Create Application**
2. Choose **Regular Web Application**
3. Name it (e.g., `Core Panel`)
4. Note the **Domain**, **Client ID**, and **Client Secret**

### 2. Enable Resource Owner Password Grant

1. In your Application settings → scroll to **Advanced Settings → Grant Types**
2. Enable **Password** grant type
3. Save changes

### 3. Set the Default Directory

1. Go to **Auth0 Dashboard → Settings (tenant settings)**
2. Under **API Authorization Settings**, set **Default Directory** to `Username-Password-Authentication`
3. Save changes

### 4. Create an API

1. Go to **Applications → APIs → Create API**
2. Set a name and identifier (e.g., `https://your-api`)
3. This becomes your `AUTH0_AUDIENCE`

### 5. Enable MFA (TOTP)

1. Go to **Security → Multi-factor Auth**
2. Enable **One-time Password (OTP / TOTP)**
3. Set the policy to **Always** (or **Opt-in** for testing)
4. Save changes

### 6. Configure CORS / Allowed Origins

In your Application settings:
- **Allowed Callback URLs**: `http://localhost:3000` (add production URL)
- **Allowed Logout URLs**: `http://localhost:3000`
- **Allowed Web Origins**: `http://localhost:3000`

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally
- Auth0 account (free tier works)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

**Backend:**
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your values
```

**Frontend:**
```bash
cp apps/frontend/.env.local.example apps/frontend/.env.local
# Edit apps/frontend/.env.local with your values
```

### 3. Create the database

```bash
createdb auth_db
```

### 4. Run database migrations

```bash
cd apps/backend
npm run db:push
```

### 5. Start development servers

```bash
# From root
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000

---

## Environment Variables

### apps/backend/.env

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/auth_db` |
| `AUTH0_DOMAIN` | Your Auth0 tenant domain | `your-tenant.auth0.com` |
| `AUTH0_CLIENT_ID` | Auth0 Application Client ID | `abc123...` |
| `AUTH0_CLIENT_SECRET` | Auth0 Application Client Secret | `xyz789...` |
| `AUTH0_AUDIENCE` | Auth0 API identifier | `https://your-api` |
| `COOKIE_SECRET` | Secret for signing cookies | `a-long-random-string-32chars+` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |

### apps/frontend/.env.local

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:4000` |

---

## Auth Flow

### Login (no MFA)
```
User → POST /api/auth/login → Auth0 Resource Owner Password Grant
                            ↓ access_token
Backend upserts user in DB → sets httpOnly cookie → { status: "ok" }
Frontend → redirect /dashboard
```

### Login (MFA required — first time)
```
User → POST /api/auth/login → Auth0 returns mfa_required + mfa_token
Backend returns { status: "mfa_required", mfaToken, mfaEnrolled: false }
Frontend → /login/mfa-enroll
  → POST /api/auth/mfa-enroll → Auth0 /mfa/associate → QR code URI + secret
  → User scans QR, enters OTP
  → POST /api/auth/mfa-verify → Auth0 grants access_token → cookie set
Frontend → redirect /dashboard
```

### Login (MFA required — returning user)
```
User → POST /api/auth/login → Auth0 returns mfa_required + mfa_token
Backend returns { status: "mfa_required", mfaToken, mfaEnrolled: true }
Frontend → /login/mfa
  → User enters 6-digit OTP
  → POST /api/auth/mfa-verify → Auth0 grants access_token → cookie set
Frontend → redirect /dashboard
```

---

## Project Structure

```
/
├── apps/
│   ├── frontend/
│   │   └── src/
│   │       ├── app/           # Next.js App Router pages
│   │       ├── components/    # Reusable UI components
│   │       ├── lib/           # API client
│   │       └── theme/         # MUI theme
│   └── backend/
│       └── src/
│           ├── db/            # Drizzle ORM schema + connection
│           ├── middleware/    # verifyToken, errorHandler
│           ├── routes/        # auth routes
│           └── index.ts       # Express server entry
├── packages/
│   └── shared/
│       └── src/types/         # Shared TypeScript types
├── package.json               # npm workspaces root
└── turbo.json                 # Turborepo config
```

---

## Security Checklist

- [x] httpOnly cookies (XSS-safe)
- [x] sameSite=strict (CSRF-safe)
- [x] secure flag in production
- [x] CORS restricted to FRONTEND_URL
- [x] Helmet.js security headers
- [x] JWT verification with Auth0 JWKS
- [x] Zod validation on all inputs (frontend + backend)
- [x] No sensitive data logged
- [x] Request body size limited to 10kb

# Security Review -- Doctors Dashboard API (supabase-migration branch)

**Date:** 2026-07-03  
**Branch:** `supabase-migration`  
**Scope:** All endpoints across BD-01 and BD-02 modules  
**Files reviewed:** [server.js](server.js), [controllers](controllers), [middleware](middleware), all route files, [config/supabase.js](config/supabase.js), [.env.example](.env.example), [package.json](package.json)

---

## Executive Summary

This branch migrates the backend from MySQL to Supabase (PostgreSQL). It introduces local JWKS-based JWT verification, per-request RLS-enforced Supabase clients, and a service-role admin client. However, the review uncovered **7 critical**, **5 high**, and **5 medium** severity issues. The report and document modules are entirely non-functional, and multiple routes across the application are broken.

---

## CRITICAL Findings

### C1 -- ALL report routes have NO middleware and NO handler

[reportRoutes.js](routes/reportRoutes.js) -- every single route is a bare skeleton with no auth middleware and no controller wired:

```js
router.get("/");        // L5 — no middleware, no handler
router.get("/:id");     // L8 — no middleware, no handler
router.post("/");       // L11 — no middleware, no handler
router.put("/:id");     // L14 — no middleware, no handler
router.delete("/:id");  // L17 — no middleware, no handler
```

> [!CAUTION]
> All 5 report endpoints will **hang indefinitely** on any request (Express never sends a response). No authentication, no authorization, no logic. This is the most severe issue in the codebase.

**Fix:** Wire all routes to their controller methods with `authMiddleware`:
```js
const middleware = require('../middleware');
const { reportController } = require('../controllers');

router.get('/', middleware.authMiddleware, reportController.getReports);
router.get('/:id', middleware.authMiddleware, reportController.getReportById);
router.post('/', middleware.authMiddleware, reportController.createReport);
router.put('/:id', middleware.authMiddleware, reportController.updateReport);
router.delete('/:id', middleware.authMiddleware, reportController.deleteReport);
```

---

### C2 -- ALL document routes have NO middleware and NO handler

[documentRoutes.js](routes/documentRoutes.js) -- identical issue to reports:

```js
router.get("/");        // L5 — no middleware, no handler
router.get("/:id");     // L8 — no middleware, no handler
router.post("/");       // L11 — no middleware, no handler
router.put("/:id");     // L14 — no middleware, no handler
router.delete("/:id");  // L17 — no middleware, no handler
```

> [!CAUTION]
> All 5 document endpoints are completely broken -- hanging requests with zero security.

**Fix:** Same pattern as C1 -- wire to controllers with `authMiddleware`.

---

### C3 -- `GET /api/doctors` and `GET /api/doctors/:id` have NO authentication

[doctorRoutes.js:L7-L8](routes/doctorRoutes.js#L7-L8):
```js
router.get('/', asyncHandler(doctorController.getDoctors));
router.get('/:id', asyncHandler(doctorController.getDoctorById));
```

> [!CAUTION]
> **Anyone on the internet** can list all doctors and retrieve individual profiles (names, emails, specializations) without any token. This is a direct PII data leak.

Additionally, the controller at [controllers:L195](controllers#L195) falls back to an unauthenticated Supabase client:
```js
const supabase = req.supabase || createSupabaseClient();
```
This means requests bypass RLS entirely.

**Fix:** Add `authMiddleware` to both routes.

---

### C4 -- `GET /api/patients/:id` has NO ownership check (IDOR)

[controllers:L300-L318](controllers#L300-L318) -- fetches a patient by ID without filtering by `doctor_id`:

```js
const { data: patients, error } = await req.supabase
  .from('patients')
  .select('*')
  .eq('patient_id', id);
```

> [!CAUTION]
> Any authenticated doctor can read any patient's full medical record (name, DOB, gender, phone, email, diagnosis) by enumerating IDs. This is an **Insecure Direct Object Reference (IDOR)** vulnerability.

**Note:** RLS policies may partially mitigate this depending on their configuration, but the application code has no defense and should not rely solely on RLS.

**Fix:** Add `.eq('doctor_id', req.user.id)` to the query.

---

### C5 -- `POST /api/auth/logout` does nothing server-side

[controllers:L164-L169](controllers#L164-L169) returns a success message but **never invalidates the Supabase session/token**:

```js
logout: async (req, res) => {
  res.status(200).json({
    message: 'Logged out successfully. Please discard the authentication token on the client side.'
  });
}
```

> [!IMPORTANT]
> Without calling `supabaseAdmin.auth.admin.signOut()` or similar, "logout" is purely cosmetic. Stolen or leaked JWTs remain valid until expiry.

**Fix:** Accept the token from the Authorization header and call Supabase's signOut:
```js
logout: async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    await supabaseAdmin.auth.admin.signOut(token);
  }
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
}
```

---

### C6 -- All report controller methods are stubs (200 OK with no logic)

[controllers:L786-L806](controllers#L786-L806) -- all 5 report controller methods return hardcoded success messages:

```js
getReports:    async (req, res) => { res.status(200).json({ message: "Get all reports" }); }
getReportById: async (req, res) => { res.status(200).json({ message: "Get report by ID" }); }
createReport:  async (req, res) => { res.status(201).json({ message: "Create report" }); }
updateReport:  async (req, res) => { res.status(200).json({ message: "Update report" }); }
deleteReport:  async (req, res) => { res.status(200).json({ message: "Delete report" }); }
```

> [!CAUTION]
> Even if routes were wired (C1), these stubs return 200/201 with no data access, no authorization, and no business logic. Any client calling these endpoints will believe the operation succeeded.

**Fix:** Implement proper logic with `req.supabase` and `doctor_id` scoping, or return `501 Not Implemented`.

---

### C7 -- All document controller methods are stubs (200 OK with no logic)

[controllers:L812-L832](controllers#L812-L832) -- identical issue to C6. All 5 document methods are empty stubs returning hardcoded success.

---

## HIGH Findings

### H1 -- CORS allows all origins (`origin: '*'`)

[server.js:L37](server.js#L37):
```js
origin: '*'
```

> [!WARNING]
> Any website can make authenticated cross-origin requests to your API. Combined with Bearer token auth, a malicious site could make API calls using a doctor's token if obtained via XSS or other means.

**Fix:** Restrict to your frontend domain(s):
```js
origin: process.env.CORS_ORIGIN || 'https://your-dashboard.com'
```

---

### H2 -- `createAppointment` has NO patient ownership check

[controllers:L486-L519](controllers#L486-L519) -- inserts an appointment using `patient_id` from the request body without verifying the patient belongs to the authenticated doctor:

```js
const { data: newAppointment, error } = await req.supabase
  .from('appointments')
  .insert([{
    doctor_id: doctorId,
    patient_id,    // <-- unverified, user-supplied
    ...
  }])
  .select();
```

> [!WARNING]
> Doctor A can create appointments referencing Doctor B's patients. This breaks data isolation between doctors.

**Fix:** Verify patient ownership before inserting:
```js
const { data: patient } = await req.supabase
  .from('patients')
  .select('patient_id')
  .eq('patient_id', patient_id)
  .eq('doctor_id', doctorId);

if (!patient || patient.length === 0) {
  return res.status(404).json({ success: false, message: 'Patient not found.' });
}
```

---

### H3 -- `PUT /api/appointments/:id` route is missing

[appointmentRoutes.js](routes/appointmentRoutes.js) only defines `GET /` and `POST /`. There is **no PUT route** for updating appointments, despite being documented. The `updateAppointment` controller method from the main branch was removed.

> [!WARNING]
> Appointment updates are completely unavailable on this branch.

---

### H4 -- Health endpoint leaks internal info

[server.js:L48-L55](server.js#L48-L55) returns `env` and `uptime`:

```js
env: process.env.NODE_ENV || 'development',
uptime: process.uptime()
```

> [!WARNING]
> Exposes environment mode and server uptime to unauthenticated users.

**Fix:** Remove sensitive fields from production or protect the endpoint.

---

### H5 -- No rate limiting on auth endpoints

`/api/auth/login` and `/api/auth/register` have no rate limiting. An attacker can brute-force credentials or flood registrations.

**Fix:** Use `express-rate-limit`:
```js
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth', authLimiter);
```

---

## MEDIUM Findings

### M1 -- `getDoctors` error response leaks stack trace

[controllers:L210](controllers#L210):
```js
res.status(500).json({
  success: false,
  message: 'Internal server error retrieving doctors.',
  error: error.message,
  stack: error.stack    // <-- NEVER expose in production
});
```

> [!WARNING]
> Full stack traces reveal internal file paths, library versions, and code structure. This is an information disclosure vulnerability.

**Fix:** Remove `error` and `stack` from the response:
```js
res.status(500).json({ success: false, message: 'Internal server error retrieving doctors.' });
```

---

### M2 -- Supabase client falls back to placeholder credentials

[config/supabase.js:L16-L17](config/supabase.js#L16-L17) and [L37-L38](config/supabase.js#L37-L38):
```js
supabaseUrl || 'https://placeholder-project-url.supabase.co'
supabaseServiceRoleKey || 'placeholder-service-role-key'
```

> [!IMPORTANT]
> If environment variables are missing, the server starts silently with broken auth instead of failing fast. This masks configuration errors.

**Fix:** Throw on startup if required env vars are missing.

---

### M3 -- `.env.example` is missing `SUPABASE_SERVICE_ROLE_KEY`

[.env.example](.env.example) defines `SUPABASE_URL` and `SUPABASE_ANON_KEY` but does NOT include `SUPABASE_SERVICE_ROLE_KEY`, which is required by [config/supabase.js:L8](config/supabase.js#L8). It also still lists MySQL config (`DB_HOST`, `DB_USER`, etc.) which is no longer used on this branch.

**Fix:** Update `.env.example` to reflect the actual required variables.

---

### M4 -- 404 handler reflects request URL

[server.js:L70](server.js#L70):
```js
message: `Route not found: ${req.method} ${req.originalUrl}`
```

Reflecting user input back in responses is a defense-in-depth concern.

---

### M5 -- Auto-provisioning in auth middleware creates implicit trust

[middleware:L66-L87](middleware#L66-L87) auto-creates a doctor record for any valid Supabase Auth user. If Supabase sign-up is unrestricted, anyone who registers gets automatic doctor-level access to the system.

---

## What's Done Well

| Area | Detail |
|---|---|
| **Local JWKS Verification** | JWT tokens are verified locally with cached JWKS keys, reducing latency and Supabase API calls. Includes automatic key refresh on `kid` mismatch. |
| **RLS-Enforced Clients** | `req.supabase` is created per-request with the user's token, enforcing Supabase Row Level Security policies |
| **Service Role Separation** | Admin operations use `supabaseAdmin`, while user operations use `createSupabaseClient(token)` -- proper least-privilege pattern |
| **Session Notes Module** | Fully implemented with proper `doctor_id` scoping on all CRUD operations |
| **Patient Write Operations** | `updatePatientById`, `deletePatientById`, `upsertPatientProfile` all scope by `doctor_id` |
| **Parameterized Queries** | All Supabase queries use the SDK's built-in parameterization (`.eq()`, `.insert()`) -- no raw SQL injection risk |
| **Helmet.js** | Enabled for security headers |
| **`.env` not tracked** | `.env` is in `.gitignore` and not committed |
| **Clean Auth Clients** | Login/register use `persistSession: false` to avoid session pollution on the server |
| **Error Handling** | Global error handler + async wrapper prevent unhandled promise rejections |

---

## Summary by Endpoint

| Endpoint | Auth | Authz | IDOR | Input Val. | Status |
|---|---|---|---|---|---|
| `POST /auth/register` | N/A | N/A | -- | PASS | WARN: No rate limit |
| `POST /auth/login` | N/A | N/A | -- | PASS | WARN: No rate limit |
| `POST /auth/logout` | N/A | N/A | -- | -- | FAIL: Token not invalidated |
| `GET /auth/profile` | PASS | -- | PASS | -- | PASS |
| `GET /doctors` | FAIL: None | FAIL: None | -- | -- | FAIL: PII leak |
| `GET /doctors/:id` | FAIL: None | FAIL: None | -- | -- | FAIL: PII leak, stack trace leak |
| `PUT /doctors/profile` | PASS | PASS | PASS | -- | PASS |
| `GET /patients` | PASS | PASS | PASS | PASS | PASS |
| `POST /patients` | PASS | PASS | PASS | PASS | PASS |
| `GET /patients/:id` | PASS | -- | FAIL: No | -- | FAIL: Any doctor reads any patient |
| `PUT /patients/profile` | PASS | PASS | PASS | -- | PASS |
| `PUT /patients/:id` | PASS | PASS | PASS | PASS | PASS |
| `DELETE /patients/:id` | PASS | PASS | PASS | -- | PASS |
| `GET /appointments` | PASS | -- | PASS | -- | PASS |
| `POST /appointments` | PASS | -- | FAIL: Partial | PASS | FAIL: No patient ownership |
| `PUT /appointments/:id` | -- | -- | -- | -- | FAIL: Route missing |
| `GET /sessions` | PASS | -- | PASS | -- | PASS |
| `GET /sessions/:id` | PASS | -- | PASS | -- | PASS |
| `POST /sessions` | PASS | -- | PASS | PASS | PASS |
| `PUT /sessions/:id` | PASS | -- | PASS | -- | PASS |
| `DELETE /sessions/:id` | PASS | -- | PASS | -- | PASS |
| `GET /reports` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `GET /reports/:id` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `POST /reports` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `PUT /reports/:id` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `DELETE /reports/:id` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `GET /documents` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `GET /documents/:id` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `POST /documents` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `PUT /documents/:id` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |
| `DELETE /documents/:id` | FAIL: None | FAIL: None | -- | -- | FAIL: No handler (hangs) |

---

## Comparison with main branch

| Area | main branch | supabase-migration branch |
|---|---|---|
| Database | MySQL (parameterized queries) | Supabase/PostgreSQL (SDK) |
| JWT Verification | Remote `supabase.auth.getUser()` only | Local JWKS + remote fallback (improved) |
| RLS Enforcement | None (all queries via admin/pool) | Per-request RLS client (improved) |
| Report Module | Partially implemented (3 of 5 working) | Completely broken (0 of 5 working) |
| Document Module | Partially implemented (1 of 5 working) | Completely broken (0 of 5 working) |
| File Uploads | Multer + Cloudinary (no file type filter) | Removed (no upload middleware) |
| Session Notes | Working with doctor scoping | Working with doctor scoping (same) |

---

## Priority Fix Order

1. **Immediate** -- Wire all report routes to controllers with `authMiddleware` (C1)
2. **Immediate** -- Wire all document routes to controllers with `authMiddleware` (C2)
3. **Immediate** -- Add auth to `GET /doctors` and `GET /doctors/:id` (C3)
4. **Immediate** -- Fix `GET /patients/:id` IDOR (C4)
5. **Immediate** -- Implement report and document controller logic or return 501 (C6, C7)
6. **High** -- Restrict CORS origins (H1)
7. **High** -- Fix appointment patient ownership check (H2)
8. **High** -- Add missing `PUT /appointments/:id` route (H3)
9. **High** -- Add rate limiting to auth endpoints (H5)
10. **High** -- Remove stack trace from error response (M1)
11. **Medium** -- Implement proper logout with token invalidation (C5)
12. **Medium** -- Update `.env.example` and fail fast on missing config (M2, M3)

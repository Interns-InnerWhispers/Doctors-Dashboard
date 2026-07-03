# Security Review — Doctors Dashboard API

**Date:** 2026-07-03  
**Scope:** All endpoints across BD-01 and BD-02 modules  
**Files reviewed:** [server.js](server.js), [controllers](controllers), [middleware](middleware), all route files, configs, upload middleware, SQL schema

---

## Executive Summary

The codebase uses parameterized SQL queries (good), Supabase JWT auth, and Helmet. However, the review uncovered **7 critical**, **5 high**, and **6 medium** severity issues across authentication, authorization, data exposure, file upload, and route configuration.

---

## CRITICAL Findings

### C1 — Routes with NO authentication or handler attached

| Route | File | Issue |
|---|---|---|
| `GET /api/reports/:id` | [reportRoutes.js:L11](routes/reportRoutes.js#L11) | `router.get('/:id')` — **no middleware, no handler**. Express silently ignores this, meaning the route exists but does nothing (hangs forever on request). |
| `DELETE /api/reports/:id` | [reportRoutes.js:L28](routes/reportRoutes.js#L28) | `router.delete('/:id')` — **no middleware, no handler**. Same hang behavior. |

> [!CAUTION]
> These incomplete routes will cause requests to **hang indefinitely** (no response sent), eventually timing out. They also reveal that the endpoint exists to attackers probing the API.

**Fix:** Wire them to their controller methods with `authMiddleware`:
```diff
- router.get('/:id');
+ router.get('/:id', middleware.authMiddleware, reportController.getReportById);

- router.delete('/:id');
+ router.delete('/:id', middleware.authMiddleware, reportController.deleteReport);
```

---

### C2 — `GET /api/doctors` and `GET /api/doctors/:id` have NO authentication

[doctorRoutes.js:L7-L8](routes/doctorRoutes.js#L7-L8):
```js
router.get('/', asyncHandler(doctorController.getDoctors));
router.get('/:id', asyncHandler(doctorController.getDoctorById));
```

> [!CAUTION]
> **Anyone on the internet** can list all doctors and retrieve individual doctor profiles (names, emails, specializations) without any token. This is a direct PII data leak.

**Fix:** Add `authMiddleware`:
```diff
- router.get('/', asyncHandler(doctorController.getDoctors));
+ router.get('/', authMiddleware, asyncHandler(doctorController.getDoctors));
- router.get('/:id', asyncHandler(doctorController.getDoctorById));
+ router.get('/:id', authMiddleware, asyncHandler(doctorController.getDoctorById));
```

---

### C3 — `POST /api/reports` route is **never mounted**

The controller has a [createReport](controllers#L903) method, but [reportRoutes.js](routes/reportRoutes.js) **never defines `router.post('/', ...)`** for it. The only POST route is `/upload`.

> [!CAUTION]
> Creating reports via the API is completely broken — there is no route to call `createReport`.

**Fix:** Add the missing route:
```js
router.post('/', middleware.authMiddleware, reportController.createReport);
```

---

### C4 — Reports have NO doctor-scoped authorization (IDOR)

All report controller methods query Supabase **without filtering by `doctor_id`**:

| Method | Line | Issue |
|---|---|---|
| [getReports](controllers#L852-L897) | L852 | Fetches **all** reports globally — not scoped to `req.user.id` |
| [createReport](controllers#L903-L948) | L903 | Accepts `doctor_id` **from the request body** — attacker can impersonate any doctor |
| [updateReport](controllers#L1003-L1045) | L1003 | Updates any report by ID with no ownership check |
| [uploadReport](controllers#L950-L1001) | L950 | Updates `pdf_url` on any `report_id` — no ownership verification |

> [!CAUTION]
> **Insecure Direct Object Reference (IDOR)**: Any authenticated doctor can read, modify, or upload files to any other doctor's reports.

**Fix:** All report queries must include `AND doctor_id = req.user.id`. The `doctor_id` in `createReport` should come from `req.user.id`, not the request body.

---

### C5 — Documents have NO doctor-scoped authorization (IDOR)

[uploadDocument](controllers#L1065-L1119) accepts `patient_id` from the request body and inserts a document without verifying that the patient belongs to the authenticated doctor. The stub handlers (`getDocuments`, `getDocumentById`, `updateDocument`, `deleteDocument`) return hardcoded messages with no authorization at all.

> [!CAUTION]
> Any authenticated doctor can upload documents to any patient. Stub handlers leak the existence of endpoints and provide no access control.

---

### C6 — `GET /api/patients/:id` has NO ownership check

[patientRoutes.js:L9](routes/patientRoutes.js#L9) — uses `authMiddleware` but **no `authorize` middleware**, and the [controller](controllers#L249-L261) fetches the patient by ID without checking `doctor_id`:

```js
'SELECT ... FROM patients WHERE patient_id = ?', [id]
```

> [!CAUTION]
> Any authenticated user can read any patient's full medical record (name, DOB, gender, phone, email, diagnosis) by enumerating IDs.

**Fix:** Add `AND doctor_id = ?` with `req.user.id`.

---

### C7 — `POST /api/auth/logout` does nothing server-side

[authController.logout](controllers#L129-L134) returns a success message but **never invalidates the Supabase session/token**. The JWT remains valid until it expires.

> [!IMPORTANT]
> Without calling `supabase.auth.signOut()` or maintaining a token blacklist, "logout" is purely cosmetic. Stolen tokens remain usable.

**Fix:** Call `supabase.auth.admin.signOut(token)` or implement server-side token revocation.

---

## HIGH Findings

### H1 — No file type validation on uploads

[uploadMiddleware.js](services/uploadMiddleware.js) only limits file size (10MB). There is **no `fileFilter`** to restrict MIME types or extensions.

> [!WARNING]
> An attacker can upload `.exe`, `.html`, `.svg` (XSS vector), or any arbitrary file type to Cloudinary under your account.

**Fix:** Add a `fileFilter`:
```js
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'));
    }
  }
});
```

---

### H2 — CORS allows all origins (`origin: '*'`)

[server.js:L40](server.js#L40):
```js
origin: '*'
```

> [!WARNING]
> Any website can make authenticated cross-origin requests to your API. This enables CSRF-like attacks where a malicious page reads data using a logged-in doctor's token (if stored in cookies or accessible via JS).

**Fix:** Restrict to your frontend domain(s):
```js
origin: process.env.CORS_ORIGIN || 'https://your-dashboard.com'
```

---

### H3 — `createAppointment` has no patient ownership check

[controllers:L419-L422](controllers#L419-L422):
```js
'SELECT patient_id FROM patients WHERE patient_id = ?', [patient_id]
```

> [!WARNING]
> It only checks if the patient **exists globally**, not that they belong to the requesting doctor. Doctor A can create appointments for Doctor B's patients.

**Fix:** Add `AND doctor_id = ?` with `req.user.id`.

---

### H4 — Health endpoint leaks internal info

[server.js:L51-L58](server.js#L51-L58) returns `env` (development/production) and `uptime` (server uptime since last restart).

> [!WARNING]
> Uptime reveals restart times (useful for timing attacks after deployments). Environment mode confirms the deployment stage.

**Fix:** Remove `env` and `uptime` from production responses, or protect the endpoint.

---

### H5 — No rate limiting on auth endpoints

`/api/auth/login` and `/api/auth/register` have no rate limiting. An attacker can brute-force credentials or spam registration.

**Fix:** Use `express-rate-limit`:
```js
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth', authLimiter);
```

---

## MEDIUM Findings

### M1 — Stub controller methods return 200 OK with no real logic

| Method | Line |
|---|---|
| `getReportById` | [L900](controllers#L900) |
| `deleteReport` | [L1048](controllers#L1048) |
| `getDocuments` | [L1058](controllers#L1058) |
| `getDocumentById` | [L1062](controllers#L1062) |
| `updateDocument` | [L1121](controllers#L1121) |
| `deleteDocument` | [L1125](controllers#L1125) |

These return `200 OK` with a hardcoded message, misleading clients into thinking the operation succeeded. Should return `501 Not Implemented`.

---

### M2 — `express.json()` has no body size limit

[server.js:L47](server.js#L47) — No `limit` option. Default is 100KB, which is reasonable, but explicitly setting it is a best practice:
```js
app.use(express.json({ limit: '100kb' }));
```

---

### M3 — MySQL connection pool has no connection limits configured

[db.js](config/db.js) creates a pool with no `connectionLimit`, `queueLimit`, or `waitForConnections` settings. Under load, this could exhaust database connections.

---

### M4 — 404 handler reflects request URL

[server.js:L73](server.js#L73):
```js
message: `Route not found: ${req.method} ${req.originalUrl}`
```
Reflecting the URL back can be a mild XSS vector if the response is rendered in a browser (unlikely for JSON APIs, but a defense-in-depth concern).

---

### M5 — Supabase client initialized with placeholder credentials

[supabase.js:L12-L13](config/supabase.js#L12-L13) falls back to `'https://placeholder-project-url.supabase.co'` and `'placeholder-anon-key'` if env vars are missing. This masks configuration failures.

**Fix:** Throw on startup if credentials are missing, rather than using placeholders.

---

### M6 — Auto-provisioning in auth middleware creates implicit trust

Both the [login controller](controllers#L89-L107) and the [authMiddleware](middleware#L37-L49) auto-create MySQL doctor records for any valid Supabase user. If Supabase sign-up is not restricted, any person who registers gets automatic doctor access.

---

## What's Done Well

| Area | Detail |
|---|---|
| **SQL Injection Prevention** | All MySQL queries use parameterized queries (`?` placeholders) — no string concatenation |
| **Helmet.js** | Enabled for security headers (X-Content-Type-Options, X-Frame-Options, etc.) |
| **Soft Delete** | Patients use soft delete (`status = 'deleted'`) preserving audit trail |
| **Session notes ownership** | Session CRUD properly filters by `doctor_id` from the JWT |
| **Patient write operations** | `updatePatientById` and `deletePatientById` correctly scope by `doctor_id` |
| **`.env` not tracked** | `.env` is in `.gitignore` and not committed to git |
| **Error handling** | Global error handler catches unhandled errors; async wrapper prevents silent crashes |

---

## Summary by Endpoint

| Endpoint | Auth | Authz | IDOR | Input Val. | Status |
|---|---|---|---|---|---|
| `POST /auth/register` | N/A | N/A | — | PASS | WARN: No rate limit |
| `POST /auth/login` | N/A | N/A | — | PASS | WARN: No rate limit |
| `POST /auth/logout` | N/A | N/A | — | — | FAIL: Token not invalidated |
| `GET /auth/profile` | PASS | — | PASS | — | PASS |
| `GET /doctors` | FAIL: None | FAIL: None | — | — | FAIL: PII leak |
| `GET /doctors/:id` | FAIL: None | FAIL: None | — | — | FAIL: PII leak |
| `PUT /doctors/profile` | PASS | PASS | PASS | — | PASS |
| `GET /patients` | PASS | PASS | PASS | PASS | PASS |
| `POST /patients` | PASS | PASS | PASS | PASS | PASS |
| `GET /patients/:id` | PASS | — | FAIL: No | — | FAIL: Any doctor reads any patient |
| `PUT /patients/profile` | PASS | PASS | PASS | — | PASS |
| `PUT /patients/:id` | PASS | PASS | PASS | PASS | PASS |
| `DELETE /patients/:id` | PASS | PASS | PASS | — | PASS |
| `GET /appointments` | PASS | — | PASS | — | PASS |
| `POST /appointments` | PASS | — | PARTIAL | PASS | WARN: No patient ownership |
| `PUT /appointments/:id` | PASS | — | PASS | — | PASS |
| `GET /sessions` | PASS | — | PASS | — | PASS |
| `GET /sessions/:id` | PASS | — | PASS | — | PASS |
| `POST /sessions` | PASS | — | PASS | PASS | PASS |
| `PUT /sessions/:id` | PASS | — | PASS | — | PASS |
| `DELETE /sessions/:id` | PASS | — | PASS | — | PASS |
| `GET /reports` | PASS | — | FAIL: No | — | FAIL: Returns all doctors' reports |
| `GET /reports/:id` | FAIL: None | FAIL: None | — | — | FAIL: No handler (hangs) |
| `POST /reports` | FAIL: No route | — | — | — | FAIL: Never mounted |
| `POST /reports/upload` | PASS | — | FAIL: No | WARN: No file type check | FAIL |
| `PUT /reports/:id` | PASS | — | FAIL: No | — | FAIL: Any doctor updates any report |
| `DELETE /reports/:id` | FAIL: None | FAIL: None | — | — | FAIL: No handler (hangs) |
| `GET /documents` | PASS | — | — | — | WARN: Stub |
| `GET /documents/:id` | PASS | — | — | — | WARN: Stub |
| `POST /documents` | PASS | — | FAIL: No | WARN: No file type check | FAIL: No patient ownership |
| `PUT /documents/:id` | PASS | — | — | — | WARN: Stub |
| `DELETE /documents/:id` | PASS | — | — | — | WARN: Stub |

---

## Priority Fix Order

1. **Immediate** — Fix broken routes in `reportRoutes.js` (C1, C3)
2. **Immediate** — Add auth to `GET /doctors` and `GET /doctors/:id` (C2)  
3. **Immediate** — Add `doctor_id` scoping to all report & document controllers (C4, C5)
4. **Immediate** — Fix `GET /patients/:id` IDOR (C6)
5. **High** — Add file type validation to upload middleware (H1)
6. **High** — Restrict CORS origins (H2)
7. **High** — Fix appointment patient ownership (H3)
8. **High** — Add rate limiting to auth endpoints (H5)
9. **Medium** — Implement proper logout (C7)
10. **Medium** — Fix stub handlers to return 501 (M1)

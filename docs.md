# Technical Documentation: Supabase Backend Migration

This document outlines the architecture, implementation details, and step-by-step integration of the full **Supabase** migration for the Doctors-Dashboard backend.

---

## 1. Objective & Design Decisions

### The Goal
Transition the backend from a local MySQL database with custom session authentication to a fully managed cloud backend using **Supabase** for both Identity and Access Management (Auth) and PostgreSQL database storage.

### Why Supabase?
1. **Security & Auth**: We delegate sensitive operations like password hashing and session management to Supabase. It issues industry-standard JWTs for secure integration.
2. **PostgreSQL Power**: Supabase provides a powerful Postgres database with Row Level Security (RLS) built-in, securing patient data at the database level.
3. **Streamlined SDK**: Replaced raw SQL queries and connection pools with the highly readable `@supabase/supabase-js` query builder.

### Architectural Decisions
* **Full Backend Migration**: 
  - The local MySQL database and `mysql2` dependencies have been completely removed.
  - All entities (doctors, patients, appointments, sessions) now reside in Supabase PostgreSQL.
* **Dual Client Strategy**:
  - `supabaseAdmin` (Service Role): Used exclusively for privileged operations like auto-provisioning a doctor record directly after they sign up via Auth. Bypasses RLS.
  - `req.supabase` (JWT-scoped Client): Attached to authenticated requests via `authMiddleware`. All standard CRUD operations use this client to ensure Row Level Security (RLS) policies are automatically enforced per user.
* **Backward Compatibility**:
  - API endpoint paths and JSON payload structures were preserved to ensure frontend clients do not break.

---

## 2. Comprehensive Changeset

### 2.1 Dependencies
* Installed `@supabase/supabase-js` to configure the backend Supabase SDK client.
* Uninstalled `mysql2`.

### 2.2 Configuration Files
#### [config/supabase.js](file:///d:/Projects/Doctors-Dashboard/config/supabase.js) [NEW]
Initializes the Supabase connection client.
```javascript
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: SUPABASE_URL or SUPABASE_ANON_KEY is not defined in environment variables. Supabase authentication calls will fail.');
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder-project-url.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

module.exports = supabase;
```

#### [.env](file:///d:/Projects/Doctors-Dashboard/.env) and [.env.example](file:///d:/Projects/Doctors-Dashboard/.env.example) [MODIFY]
Appended Supabase credential fields:
```ini
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-anon-public-key>
```

---

### 2.3 Database Layer
* **Removed Local Database**: The `config/db.js` file and `sql/schema.sql` file were deleted.
* **Supabase PostgreSQL**: Tables, foreign keys, and RLS policies are now managed exclusively via the Supabase dashboard.

---

### 2.4 Middleware
#### [middleware](file:///d:/Projects/Doctors-Dashboard/middleware) [MODIFY]
Optimized `authMiddleware` to verify Supabase JWTs locally:
* Reads `Authorization: Bearer <TOKEN>` header.
* **Local Verification**: Performs asymmetric cryptographic validation on the JWT locally using public keys fetched from the Supabase JWKS (`.well-known/jwks.json`) endpoint. The public keys are cached in memory (24h TTL) to avoid network overhead.
* **Remote Fallback**: If local validation fails or key is missing, it falls back to calling `supabaseAdmin.auth.getUser(token)` remotely to ensure reliability.
* Retrieves user from the `doctors` table in Supabase.
* Sets `req.user = { id: doctor.doctor_id, email: doctor.email, role: 'doctor', supabase_uid: user.id }`.
* **Most Importantly**: Attaches an RLS-enforced Supabase client instance to `req.supabase` that uses the user's JWT.

---

### 2.5 Controllers
#### [controllers](file:///d:/Projects/Doctors-Dashboard/controllers) [MODIFY]
* **`authController`**: 
  - Signs up the doctor in Supabase Auth.
  - Inserts the new profile into the `doctors` table using the `supabaseAdmin` service role client to bypass RLS during registration.
  - Authenticates with Supabase using `signInWithPassword`.
* **CRUD Controllers (`doctorController`, `patientController`, `appointmentController`, `sessionController`)**:
  - Replaced all raw MySQL queries with Supabase Javascript query builders (`.from()`, `.select()`, `.insert()`, `.update()`).
  - Utilized `req.supabase` to ensure all queries are bound to the authenticated user's RLS policies.
  - Fallbacks to an anonymous client (`createSupabaseClient()`) for unprotected public routes (e.g., getting public doctor directories).

---

## 3. Step-by-Step Supabase Setup

To initialize and setup Supabase Auth for your backend:

### 3.1 Setup Project
1. Log in to [Supabase Console](https://supabase.com).
2. Click **New Project** and input your project database details. Wait for deployment to finish.
3. Open **Project Settings** > **API** (in the sidebar), copy the **Project URL** and the **anon public key**, and save them to your `.env` file under `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 3.2 Disable Email Confirmation (Recommended for Dev Env)
By default, Supabase requires email verification before users can log in:
1. Navigate to **Authentication** > **Providers** > **Email** in the Supabase Dashboard.
2. Disable the **Confirm email** toggle.
3. Click **Save**.

### 3.3 Confirm Test Users manually
If you register a user with email confirmation enabled:
1. Go to **Authentication** > **Users**.
2. Locate the user, click **`...`** (Actions) on the right, and select **Confirm User**.

---

## 4. API Endpoint Testing Guide

### 4.1 Register a Doctor
* **Method**: `POST`
* **URL**: `http://localhost:5000/api/auth/register`
* **Body** (`JSON`):
  ```json
  {
    "name": "Dr. Sarah Connor",
    "email": "sarah.connor@hospital.com",
    "password": "securepassword123",
    "specialization": "Neurology"
  }
  ```

### 4.2 Log In
* **Method**: `POST`
* **URL**: `http://localhost:5000/api/auth/login`
* **Body** (`JSON`):
  ```json
  {
    "email": "sarah.connor@hospital.com",
    "password": "securepassword123"
  }
  ```
* **Expected Response**: Copy the value of the `"token"` field from the returned payload.

### 4.3 Retrieve Profile
* **Method**: `GET`
* **URL**: `http://localhost:5000/api/auth/profile`
* **Headers**:
  * **Key**: `Authorization`
  * **Value**: `Bearer <paste_your_copied_token_here>`

---

## 5. Complete API Reference

### 5.1 Authentication Endpoints

#### 5.1.1 Register a Doctor
- **URL**: `POST /api/auth/register`
- **Description**: Registers a new doctor account using Supabase Auth and creates a linked record in the local MySQL database.
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah Connor",
    "email": "sarah.connor@hospital.com",
    "password": "securepassword123",
    "specialization": "Neurology",
    "profile_image": "https://example.com/image.jpg"
  }
  ```
- **Success Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Doctor registered successfully.",
    "user": {
      "id": 1,
      "supabase_uid": "uuid-string",
      "name": "Dr. Sarah Connor",
      "email": "sarah.connor@hospital.com",
      "specialization": "Neurology",
      "profile_image": "https://example.com/image.jpg",
      "role": "doctor"
    }
  }
  ```

#### 5.1.2 Log In
- **URL**: `POST /api/auth/login`
- **Description**: Authenticates a doctor using their credentials and returns an access token.
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "sarah.connor@hospital.com",
    "password": "securepassword123"
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Logged in successfully.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...",
    "user": {
      "id": 1,
      "supabase_uid": "uuid-string",
      "name": "Dr. Sarah Connor",
      "email": "sarah.connor@hospital.com",
      "specialization": "Neurology",
      "profile_image": null,
      "role": "doctor"
    }
  }
  ```

#### 5.1.3 Log Out
- **URL**: `POST /api/auth/logout`
- **Description**: Stateless logout confirmation. Client should discard the authentication token.
- **Headers**: None
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Logged out successfully. Please discard the authentication token on the client side."
  }
  ```

#### 5.1.4 Get Profile
- **URL**: `GET /api/auth/profile`
- **Description**: Retrieves the profile information of the currently authenticated doctor.
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "user": {
      "doctor_id": 1,
      "supabase_uid": "uuid-string",
      "name": "Dr. Sarah Connor",
      "email": "sarah.connor@hospital.com",
      "specialization": "Neurology",
      "profile_image": null,
      "created_at": "2024-06-09T10:00:00.000Z"
    }
  }
  ```

---

### 5.2 Doctors Endpoints

#### 5.2.1 Get All Doctors
- **URL**: `GET /api/doctors`
- **Description**: Retrieves a list of all registered doctors.
- **Headers**: None required.
- **Query Parameters**:
  - `specialty` (Optional): Filter doctors by a specific medical specialization.
    - *Example*: `?specialty=Neurology`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "doctors": [
      {
        "doctor_id": 1,
        "name": "Dr. Sarah Connor",
        "email": "sarah.connor@hospital.com",
        "specialization": "Neurology",
        "profile_image": null,
        "created_at": "2024-06-09T10:00:00.000Z"
      }
    ]
  }
  ```

#### 5.2.2 Get Doctor by ID
- **URL**: `GET /api/doctors/:id`
- **Description**: Retrieves a single doctor's profile by their local `doctor_id`.
- **Headers**: None required.
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "doctor": {
      "doctor_id": 1,
      "name": "Dr. Sarah Connor",
      "email": "sarah.connor@hospital.com",
      "specialization": "Neurology",
      "profile_image": null,
      "created_at": "2024-06-09T10:00:00.000Z"
    }
  }
  ```

#### 5.2.3 Update Doctor Profile
- **URL**: `PUT /api/doctors/profile`
- **Description**: Updates the authenticated doctor's profile details.
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah J. Connor",
    "specialization": "Pediatric Neurology",
    "profile_image": "https://example.com/new_image.jpg"
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Doctor profile updated successfully."
  }
  ```

---

### 5.3 Patients Endpoints

#### 5.3.1 Get All Patients (List with Filters & Pagination)
- **URL**: `GET /api/patients`
- **Description**: Retrieves a paginated list of patients belonging to the authenticated doctor, excluding soft-deleted ones.
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters** (Optional):
  - `page`: Page number (default: 1)
  - `limit`: Number of records per page (default: 10)
  - `name`: Filter by patient name (partial match)
  - `status`: Filter by patient status (e.g., Active)
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "patients": [
      {
        "patient_id": 1,
        "doctor_id": 1,
        "name": "John Doe",
        "dob": "1990-01-01T00:00:00.000Z",
        "gender": "Male",
        "phone": "555-1234",
        "email": "john.doe@example.com",
        "diagnosis": "Mild Hypertension",
        "status": "Active",
        "created_at": "2024-06-09T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
  ```

#### 5.3.2 Get Patient by ID
- **URL**: `GET /api/patients/:id`
- **Description**: Retrieves a single patient's profile by their `patient_id`.
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "patient": {
      "patient_id": 1,
      "doctor_id": 1,
      "name": "John Doe",
      "dob": "1990-01-01T00:00:00.000Z",
      "gender": "Male",
      "phone": "555-1234",
      "email": "john.doe@example.com",
      "diagnosis": "Mild Hypertension",
      "status": "Active",
      "created_at": "2024-06-09T12:00:00.000Z"
    }
  }
  ```

#### 5.3.3 Create a Patient (with validation)
- **URL**: `POST /api/patients`
- **Description**: Creates a new patient linked to the authenticated doctor. Requires validation on required fields. If `status` is not provided, defaults to `'Active'`.
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "Jane Smith",
    "dob": "1992-03-15",
    "gender": "Female",
    "phone": "555-4321",
    "email": "jane.smith@example.com",
    "diagnosis": "Asthma",
    "status": "Active"
  }
  ```
  *(Note: `name` is strictly required. Other fields are optional).*
- **Success Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Patient created successfully.",
    "patient": {
      "patient_id": 2,
      "doctor_id": 14,
      "name": "Jane Smith",
      "dob": "1992-03-15T00:00:00.000Z",
      "gender": "Female",
      "phone": "555-4321",
      "email": "jane.smith@example.com",
      "diagnosis": "Asthma",
      "status": "Active",
      "created_at": "2024-06-09T19:00:00.000Z"
    }
  }
  ```

#### 5.3.4 Upsert Patient Profile
- **URL**: `PUT /api/patients/profile`
- **Description**: Creates a new patient or updates an existing patient linked to the authenticated doctor. If `patient_id` is provided, it performs an update; otherwise, it creates a new record.
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "patient_id": 1, 
    "name": "John Doe",
    "dob": "1990-01-01",
    "gender": "Male",
    "phone": "555-1234",
    "email": "john.doe@example.com",
    "diagnosis": "Mild Hypertension",
    "status": "Active"
  }
  ```
  *(Omit `"patient_id"` if creating a new patient).*
- **Success Response** (`200 OK` on Update, `201 Created` on Create):
  ```json
  {
    "success": true,
    "message": "Patient profile updated successfully."
  }
  ```

#### 5.3.4 Update Patient by ID
- **URL**: `PUT /api/patients/:id`
- **Description**: Updates the details of a specific patient. The authenticated doctor must be the owner of the patient profile.
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "John Doe Updated",
    "dob": "1990-01-01",
    "gender": "Male",
    "phone": "555-5678",
    "email": "john.doe@example.com",
    "diagnosis": "Mild Hypertension - Under Control",
    "status": "Active"
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Patient profile updated successfully."
  }
  ```

#### 5.3.5 Soft Delete Patient by ID
- **URL**: `DELETE /api/patients/:id`
- **Description**: Soft deletes a specific patient by setting their status to `'deleted'`. The patient will no longer appear in the `GET /api/patients` list.
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Patient deleted successfully."
  }
  ```

---

### 5.4 Appointments Endpoints

#### 5.4.1 Create an Appointment
- **URL**: `POST /api/appointments`
- **Description**: Creates a new appointment linked to the authenticated doctor and a specific patient.
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "patient_id": 3,
    "date": "2024-06-15",
    "time": "14:30:00",
    "type": "Consultation",
    "status": "scheduled",
    "notes": "Patient experiencing mild headaches."
  }
  ```
  *(Note: `type`, `status`, and `notes` are optional).*
- **Success Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Appointment created successfully.",
    "appointment": {
      "appt_id": 2,
      "doctor_id": 14,
      "patient_id": 3,
      "date": "2024-06-15T00:00:00.000Z",
      "time": "14:30:00",
      "type": "Consultation",
      "status": "scheduled",
      "notes": "Patient experiencing mild headaches.",
      "created_at": "2024-06-09T19:00:00.000Z"
    }
  }
  ```

#### 5.4.2 Get Appointments (List with Filters)
- **URL**: `GET /api/appointments`
- **Description**: Retrieves a list of appointments belonging to the currently authenticated doctor. Supports dynamic filtering via query parameters.
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters** (Optional):
  - `patient_id`: Filter appointments for a specific patient.
    - *Example*: `?patient_id=3`
  - `date`: Filter appointments matching a specific date (YYYY-MM-DD).
    - *Example*: `?date=2024-06-10`
  - `status`: Filter appointments by their status.
    - *Example*: `?status=scheduled`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "appointments": [
      {
        "appt_id": 1,
        "doctor_id": 14,
        "patient_id": 3,
        "date": "2024-06-10T00:00:00.000Z",
        "time": "09:00:00",
        "type": "Checkup",
        "status": "scheduled",
        "notes": "Regular checkup",
        "created_at": "2024-06-09T18:30:00.000Z"
      }
    ]
  }
  ```

---

### 5.5 Session Notes Endpoints

#### 5.5.1 Create a Session Note
- **URL**: `POST /api/sessions`
- **Description**: Creates a new patient session note linked to the authenticated doctor. Validates that `patient_id` exists and is assigned to the doctor.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "patient_id": 1,
    "concern": "Chest pain during heavy activity.",
    "observation": "Blood pressure slightly elevated.",
    "intervention": "Prescribed medication and advised rest.",
    "homework": "Track daily blood pressure.",
    "next_plan": "Review in two weeks.",
    "ai_summary": "Patient exhibits cardiac exertion symptoms."
  }
  ```
- **Success Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Session note created successfully.",
    "session": {
      "note_id": 1,
      "doctor_id": 14,
      "patient_id": 1,
      "concern": "Chest pain during heavy activity.",
      "observation": "Blood pressure slightly elevated.",
      "intervention": "Prescribed medication and advised rest.",
      "homework": "Track daily blood pressure.",
      "next_plan": "Review in two weeks.",
      "ai_summary": "Patient exhibits cardiac exertion symptoms.",
      "created_at": "2026-06-15T12:57:41.000Z"
    }
  }
  ```

#### 5.5.2 Get All Session Notes
- **URL**: `GET /api/sessions`
- **Description**: Retrieves all session notes belonging to the authenticated doctor, ordered by creation date descending.
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "sessions": [
      {
        "note_id": 1,
        "doctor_id": 14,
        "patient_id": 1,
        "concern": "Chest pain during heavy activity.",
        "observation": "Blood pressure slightly elevated.",
        "intervention": "Prescribed medication and advised rest.",
        "homework": "Track daily blood pressure.",
        "next_plan": "Review in two weeks.",
        "ai_summary": "Patient exhibits cardiac exertion symptoms.",
        "created_at": "2026-06-15T12:57:41.000Z"
      }
    ]
  }
  ```

#### 5.5.3 Get Session Note by ID
- **URL**: `GET /api/sessions/:id`
- **Description**: Retrieves details for a specific session note. The authenticated doctor must be the owner.
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "session": {
      "note_id": 1,
      "doctor_id": 14,
      "patient_id": 1,
      "concern": "Chest pain during heavy activity.",
      "observation": "Blood pressure slightly elevated.",
      "intervention": "Prescribed medication and advised rest.",
      "homework": "Track daily blood pressure.",
      "next_plan": "Review in two weeks.",
      "ai_summary": "Patient exhibits cardiac exertion symptoms.",
      "created_at": "2026-06-15T12:57:41.000Z"
    }
  }
  ```

#### 5.5.4 Update Session Note by ID
- **URL**: `PUT /api/sessions/:id`
- **Description**: Updates the details of a specific session note. The authenticated doctor must be the owner of the session note.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body** (Optional fields):
  ```json
  {
    "concern": "Updated concern...",
    "observation": "Updated observation..."
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Session note updated successfully.",
    "session": {
      "note_id": 1,
      "doctor_id": 14,
      "patient_id": 1,
      "concern": "Updated concern...",
      "observation": "Updated observation...",
      "intervention": "Prescribed medication and advised rest.",
      "homework": "Track daily blood pressure.",
      "next_plan": "Review in two weeks.",
      "ai_summary": "Patient exhibits cardiac exertion symptoms.",
      "created_at": "2026-06-15T12:57:41.000Z"
    }
  }
  ```

#### 5.5.5 Delete Session Note by ID
- **URL**: `DELETE /api/sessions/:id`
- **Description**: Deletes a specific session note. The authenticated doctor must be the owner.
- **Headers**: `Authorization: Bearer <token>`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Session note deleted successfully."
  }
  ```

---

### Error Handling

All endpoints follow this standardized error response structure for failures, such as `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, or `500 Internal Server Error`:

```json
{
  "success": false,
  "message": "A descriptive error message explaining what went wrong."
}
```

---

## 6. Authentication Response Time Optimization

Every authenticated route mounts `authMiddleware` to identify the doctor. To avoid the performance bottleneck of making an external HTTPS call to the Supabase Auth server for every individual API request, we implemented **Local JWT Verification**.

### 6.1 Architecture & Flow

Instead of calling `supabaseAdmin.auth.getUser(token)` on every request, the authentication middleware validates the token locally:

```
[Client Request]
       |
       v
[authMiddleware]
       |
  (Extract Bearer Token)
       |
       +---> [Local JWT Verification]
       |          |
       |          v
       |     (Cache Hit?)
       |      /        \
       |    YES         NO
       |    /             \
       |   v               v
       | (Decrypt       (Fetch JWKS & Update Cache)
       |  & Verify)        |
       |   |               |
       |   v               +---> (Verify Signature)
       | (Success)
       |   |
       |   +--------------------------+
       |   |                          |
       |   v (If local verify fails)   v (If local verify succeeds)
       | [Fallback: Remote Auth]     [Setup req.user & req.supabase]
       |   |                                  |
       |   v                                  v
       +---+----------------------------> [Next Middleware / Controller]
```

### 6.2 Implementation Details

1. **JWKS Fetching & Caching**:
   - The public verification keys are retrieved from the Supabase JWKS endpoint: `https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json`.
   - The keys are stored in an in-memory cache with a **24-hour Time-To-Live (TTL)**.
   - If a request is received with a key ID (`kid`) that is not present in the cached keys, the cache is immediately refreshed to accommodate rotated keys.

2. **Asymmetric Cryptographic Validation (ES256)**:
   - Supabase tokens are signed with `ES256` (ECDSA using P-256 and SHA-256).
   - Using Node.js's built-in `crypto` module, the JSON Web Key (JWK) is imported and converted to a PEM public key:
     ```javascript
     const publicKey = crypto.createPublicKey({ format: 'jwk', key: jwkKey });
     const pem = publicKey.export({ type: 'spki', format: 'pem' });
     ```
   - The JWT is then verified locally in memory using `jsonwebtoken.verify(token, pem, { algorithms: ['ES256'] })` in under **1 millisecond**.

3. **Remote Validation Fallback**:
   - If local validation fails for any reason (e.g. token expired, invalid signature, or JWKS fetch failure), the middleware catches the error, logs a debug message, and falls back to:
     ```javascript
     const { data, error } = await supabaseAdmin.auth.getUser(token);
     ```
   - This ensures 100% service reliability and backward compatibility.

### 6.3 Performance Benchmarks

| Verification Type | Avg. Verification Latency | Performance Impact |
| :--- | :--- | :--- |
| **Remote verification (`getUser`)** | ~50.81 ms | Baseline latency |
| **Local verification (Cache Miss)** | ~60.57 ms | Initial fetch overhead |
| **Local Verification (Cache Hit)** | **~0.73 ms** | **~70x faster!** |

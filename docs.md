# Technical Documentation: Supabase Authentication Integration

This document outlines the architecture, implementation details, and step-by-step integration of **Supabase Authentication** into the Doctors-Dashboard backend (BD-01 scope).

---

## 1. Objective & Design Decisions

### The Goal
Transition the existing session-less JWT authentication system to a secure, cloud-based Identity and Access Management (IAM) provider using **Supabase Auth**.

### Why Supabase?
1. **Security**: We delegate sensitive operations like password hashing, multi-factor authentication (MFA) potential, and session management to Supabase, eliminating the need to store raw hashes locally.
2. **Standard Compliance**: Supabase issues industry-standard JWTs (JSON Web Tokens) signed via standard algorithms, simplifying integration with other services.
3. **Low Friction**: We can retain all existing doctor/patient relationships in our local MySQL database while using Supabase for identity management.

### Architectural Decisions
* **Hybrid User Model**: 
  - Supabase handles credentials, authentication sessions, and issues JWT access tokens.
  - The local MySQL database continues to store doctor-specific metadata (specializations, profile pictures, and relationships to patients).
  - The two schemas are linked using the Supabase UUID as a foreign reference (`supabase_uid`) in our local MySQL `doctors` table.
* **Backward Compatibility**:
  - The downstream code in other endpoints (such as patient registration, doctor list fetching, and appointments) relies heavily on `req.user.id` being the local auto-incremented integer `doctor_id`.
  - Instead of rewriting all controllers to use string UUIDs, the `authMiddleware` resolves the Supabase UUID to the local integer ID and attaches it to `req.user.id`. The rest of the app is completely unaffected.
* **Auto-Provisioning**:
  - If a user signs up on a separate frontend or client directly with Supabase, the middleware auto-provisions a matching record in our MySQL `doctors` table during their first request.
* **Auto-Linking**:
  - If a doctor already exists in our MySQL database (registered locally in the past) and subsequently signs up with the same email on Supabase, the system automatically links their Supabase UUID to their existing MySQL record upon their first authenticated request or login.

---

## 2. Comprehensive Changeset

### 2.1 Dependencies
* Installed `@supabase/supabase-js` to configure the backend Supabase SDK client.

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
#### [sql/schema.sql](file:///d:/Projects/Doctors-Dashboard/sql/schema.sql) [MODIFY]
Modified the `doctors` table schema:
1. **Added `supabase_uid`** (`VARCHAR(255) UNIQUE DEFAULT NULL`) to map to the Supabase Auth system.
2. **Altered `password_hash`** to be nullable (`DEFAULT NULL`) since passwords are now handled on Supabase servers.

```sql
CREATE TABLE `doctors` (
  `doctor_id` INT AUTO_INCREMENT,
  `supabase_uid` VARCHAR(255) UNIQUE DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `specialization` VARCHAR(255) NOT NULL,
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`doctor_id`),
  UNIQUE KEY `idx_email` (`email`),
  KEY `idx_specialization` (`specialization`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.4 Middleware
#### [middleware](file:///d:/Projects/Doctors-Dashboard/middleware) [MODIFY]
Rewrote `authMiddleware` to handle Supabase JWT validation and MySQL synchronization:
* Reads `Authorization: Bearer <TOKEN>` header.
* Calls `supabase.auth.getUser(token)` to verify the token.
* Retrieves user by `supabase_uid` in MySQL.
* Performs **Auto-Linking** (using email fallback) or **Auto-Provisioning** (creating MySQL record if missing).
* Sets `req.user = { id: doctor.doctor_id, email: doctor.email, role: 'doctor', supabase_uid: user.id }`.

---

### 2.5 Controllers
#### [controllers](file:///d:/Projects/Doctors-Dashboard/controllers) [MODIFY]
* **`register`**: 
  - Signs up the doctor in Supabase using email, password, and custom metadata:
    ```javascript
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, specialization, profile_image } } });
    ```
  - Inserts user to local MySQL `doctors` database containing `data.user.id` (Supabase UUID).
* **`login`**: 
  - Authenticates with Supabase using `supabase.auth.signInWithPassword({ email, password })`.
  - Verifies local user exists and links/provisions them.
  - Returns `data.session.access_token` and the local profile.
* **`getProfile`**: 
  - Retrieves profile information, including `supabase_uid`, from local MySQL database using the authenticated local `doctor_id`.

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

#### 5.3.1 Get All Patients
- **URL**: `GET /api/patients`
- **Description**: Retrieves a list of all patients.
- **Headers**: `Authorization: Bearer <token>`
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
    ]
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

### Error Handling

All endpoints follow this standardized error response structure for failures, such as `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, or `500 Internal Server Error`:

```json
{
  "success": false,
  "message": "A descriptive error message explaining what went wrong."
}
```

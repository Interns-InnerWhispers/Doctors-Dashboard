# Doctors-Dashboard Backend (BD-01)

Doctors Dashboard Management System for Patient, Appointment, and Hospital Administration. This is the backend API constructed with Node.js, Express, and MySQL, implementing database tables and authentication APIs for the **BD-01** role.

---

## Technical Architecture & File Layout

- **`server.js`**: Core server bootstrapping. Registers custom compilers to support resolving and requiring extensionless module files.
- **`controllers`** (extensionless): Houses the controller logic (`authController`, `doctorController`, `patientController`) querying database tables.
- **`middleware`** (extensionless): Reusable express middleware including JWT verification, role authorization, and global async error handling.
- **`config/`**: Configuration files for MySQL connections.
- **`routes/`**: Route definitions mapping endpoints under `/api`.
- **`sql/`**: Relational database schemas.

*Note: Files belonging to other project roles (e.g. upload/rag services, appointment routes) are kept in place as empty templates.*

---

## Database Schema (BD-01 Scope)

The database schema defines the three tables belonging to the **BD-01** role:

1. **`doctors`**: Main dashboard users. Holds profile details, specialty, and login credentials.
2. **`patients`**: Patient health profiles tracked by assigned doctors.
3. **`user_sessions`**: Session-tracking store for doctor login sessions.

See [schema.sql](file:///d:/Projects/Doctors-Dashboard/sql/schema.sql) for full definitions, constraints, and index details.

---

## Getting Started

### 1. Installation
Install the project dependencies:
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```ini
PORT=5000
NODE_ENV=development

# MySQL DB
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=doctors_dashboard
DB_PORT=3306

# Supabase Authentication Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Initialization
Import the MySQL schema to initialize tables:
```bash
mysql -u root -p doctors_dashboard < sql/schema.sql
```

If you are migrating an existing database, you can run the SQL schema migration directly to make the `password_hash` column nullable and add the `supabase_uid` column:
```sql
ALTER TABLE `doctors` ADD COLUMN `supabase_uid` VARCHAR(255) UNIQUE DEFAULT NULL AFTER `doctor_id`;
ALTER TABLE `doctors` MODIFY COLUMN `password_hash` VARCHAR(255) DEFAULT NULL;
```

### 4. Running the Server
Start the development server with automatic file reloading:
```bash
npm run dev
```

The server will run on: `http://localhost:5000`

---

## Active API Routes (BD-01 Scope)

| Endpoint | Method | Middleware | Description |
|---|---|---|---|
| `/api/health` | `GET` | — | Server health indicator |
| `/api/auth/register` | `POST` | — | Register a new doctor via Supabase & link to MySQL |
| `/api/auth/login` | `POST` | — | Authenticate doctor via Supabase & issue access token |
| `/api/auth/logout` | `POST` | — | Stateless logout confirmation |
| `/api/auth/profile` | `GET` | `authMiddleware` | Fetch authenticated doctor profile |
| `/api/patients` | `GET` | `authMiddleware` | List patient records |
| `/api/patients/:id` | `GET` | `authMiddleware` | Retrieve details for a specific patient |
| `/api/patients/profile`| `PUT` | `authMiddleware` | Create or update a patient profile |

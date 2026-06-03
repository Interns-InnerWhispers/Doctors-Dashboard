# Doctors Dashboard - Database Schema (BD-02)

## Module: Sessions

### sessions

| Column Name  | Data Type         |
| ------------ | ----------------- |
| id           | INT (Primary Key) |
| patient_id   | INT               |
| session_date | DATE              |
| session_type | VARCHAR(100)      |
| notes        | TEXT              |
| status       | VARCHAR(50)       |
| created_at   | TIMESTAMP         |

---

## Module: Reports

### reports

| Column Name    | Data Type         |
| -------------- | ----------------- |
| id             | INT (Primary Key) |
| patient_id     | INT               |
| report_title   | VARCHAR(255)      |
| report_content | TEXT              |
| doctor_name    | VARCHAR(100)      |
| created_at     | TIMESTAMP         |

---

## Module: Uploads

### uploads

| Column Name | Data Type         |
| ----------- | ----------------- |
| id          | INT (Primary Key) |
| patient_id  | INT               |
| file_name   | VARCHAR(255)      |
| file_path   | VARCHAR(255)      |
| uploaded_at | TIMESTAMP         |

---

## API Planning

### Sessions APIs

* GET /sessions
* POST /sessions
* PUT /sessions/:id
* DELETE /sessions/:id

### Reports APIs

* GET /reports
* POST /reports
* PUT /reports/:id
* DELETE /reports/:id

### Upload APIs

* GET /uploads
* POST /uploads
* DELETE /uploads/:id

---

## Relationships

Patient
├── Sessions
├── Reports
└── Uploads

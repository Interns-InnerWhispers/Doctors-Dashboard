# Doctors Dashboard API Documentation
## Backend Developer (BD-02)

Base URL

```
http://localhost:5000/api
```

---

# Authentication

All endpoints require authentication.

Header

```
Authorization: Bearer <JWT_TOKEN>
```

---

# Session APIs

## GET /sessions

Description:
Retrieve all session notes of the authenticated doctor.

Method

```
GET
```

Authentication

```
Required
```

Response

```json
{
  "success": true,
  "sessions": []
}
```

---

## GET /sessions/:id

Description

Retrieve a specific session note.

Method

```
GET
```

Parameters

```
id
```

---

## POST /sessions

Description

Create a new therapy session.

Method

```
POST
```

Body

```json
{
  "patient_id": 1,
  "concern": "...",
  "observation": "...",
  "intervention": "...",
  "homework": "...",
  "next_plan": "...",
  "ai_summary": "..."
}
```

Response

```json
{
  "success": true,
  "message": "Session note created successfully."
}
```

---

## PUT /sessions/:id

Description

Update an existing session note.

Method

```
PUT
```

---

## DELETE /sessions/:id

Description

Delete a session note.

Method

```
DELETE
```

---

# Report APIs

## GET /reports

Description

Retrieve reports with pagination.

Query Parameters

```
page
limit
```

Example

```
GET /reports?page=1&limit=10
```

Response

```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 50,
  "reports": []
}
```

---

## GET /reports/:id

Retrieve a report by ID.

---

## POST /reports

Create a report.

Request Body

```json
{
  "doctor_id": 1,
  "patient_id": 1,
  "report_title": "Anxiety Assessment",
  "report_content": "...",
  "status": "draft"
}
```

---

## PUT /reports/:id

Update report.

---

## DELETE /reports/:id

Delete report.

---

## POST /reports/upload

Description

Upload report PDF/Image.

Content-Type

```
multipart/form-data
```

Field

```
file
```

Response

```json
{
  "success": true,
  "pdf_url": "https://..."
}
```

---

# Document APIs

## GET /documents

Retrieve all documents.

---

## GET /documents/:id

Retrieve document by ID.

---

## POST /documents

Upload a document.

Content-Type

```
multipart/form-data
```

Field

```
file
```

---

## PUT /documents/:id

Update document details.

---

## DELETE /documents/:id

Delete document.

---

# Response Codes

| Code | Meaning |
|------|----------|
|200|Success|
|201|Created|
|400|Bad Request|
|401|Unauthorized|
|404|Not Found|
|500|Internal Server Error|

---

# Technologies Used

- Node.js
- Express.js
- MySQL
- Supabase
- Cloudinary
- Multer
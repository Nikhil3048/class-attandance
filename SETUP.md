# AttendanceIQ — Setup Guide

## 📋 Prerequisites
- Node.js v16+ installed
- A Supabase account (free tier works)

---

## 🚀 Step 1: Supabase Setup

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → Sign in → New Project
2. Name it `attendance-iq`, set a strong DB password, choose region
3. Wait for the project to initialize (~2 minutes)

### 1.2 Run the Database Schema
1. In Supabase dashboard → **SQL Editor** → New Query
2. Copy the entire contents of `database/schema.sql`
3. Paste and click **Run**
4. You should see "Success. No rows returned."

### 1.3 Get Your API Keys
Go to **Settings → API** in your Supabase project:
- **Project URL** → copy this (e.g., `https://xxxx.supabase.co`)
- **anon public** key → copy this
- **service_role secret** key → copy this (keep it secret!)

---

## 🔧 Step 2: Configure Environment Variables

Copy the example file and fill in your keys:

```bash
copy .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
PORT=3000
NODE_ENV=development
```

---

## 📦 Step 3: Install Dependencies

```bash
npm install
```

---

## 👤 Step 4: Create the First Admin User

Since there's no admin yet, use the Supabase Auth dashboard:

1. In Supabase → **Authentication → Users** → **Add User**
2. Fill in: Email: `admin@college.edu`, Password: `Admin@123`
3. Click **Create User** — copy the generated **UUID**
4. Go to **SQL Editor** → run:

```sql
INSERT INTO public.users (id, name, email, role)
VALUES ('paste-uuid-here', 'System Admin', 'admin@college.edu', 'admin');
```

---

## ▶️ Step 5: Start the Server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

Open: **http://localhost:3000**

---

## 🏫 Step 6: Set Up Sample Data

After logging in as Admin:

### Add Classes
- Admin Panel → Classes → Add Class
- Examples: `CS-A 2024`, `CS-B 2024`, `IT-A 2024`

### Add Teachers
- Admin Panel → Teachers → Add Teacher
- Example: Name: `Prof. Sharma`, Email: `sharma@college.edu`, Password: `Teacher@123`

### Add Subjects
- Admin Panel → Subjects → Add Subject
- Example: `Data Structures` → Class: `CS-A 2024` → Teacher: `Prof. Sharma`

### Add Students
- Admin Panel → Students → Add Student
- Example: Name: `Nikhil Raj`, Reg. No: `CS2024001`, Class: `CS-A 2024`

### Link Student to Login Account
1. Create student login: Admin Panel → (create user with role=student)
2. Get the user UUID from Supabase Auth dashboard
3. Update student record via SQL:
```sql
UPDATE public.students 
SET user_id = 'student-user-uuid'
WHERE registration_number = 'CS2024001';
```

---

## 🔑 Demo Credentials (after setup)

| Role    | Email                  | Password    |
|---------|------------------------|-------------|
| Admin   | admin@college.edu      | Admin@123   |
| Teacher | sharma@college.edu     | Teacher@123 |
| Student | student@college.edu    | Student@123 |

---

## 📁 Project Structure

```
attandance_record/
├── server/
│   ├── index.js              # Express entry point
│   ├── config/
│   │   └── supabase.js       # Supabase client
│   ├── middleware/
│   │   └── auth.js           # JWT auth + role middleware
│   └── routes/
│       ├── auth.js           # Login/register routes
│       ├── admin.js          # Admin routes
│       ├── teacher.js        # Teacher routes
│       ├── student.js        # Student routes
│       └── attendance.js     # Attendance mark/edit routes
├── public/
│   ├── index.html            # Single page app entry
│   ├── css/
│   │   └── style.css         # Full dark-mode stylesheet
│   ├── js/
│   │   ├── api.js            # API client
│   │   ├── utils.js          # Shared utilities + icons
│   │   ├── app.js            # App controller + routing
│   │   └── pages/
│   │       ├── admin.js      # Admin dashboard pages
│   │       ├── teacher.js    # Teacher dashboard pages
│   │       └── student.js    # Student dashboard pages
│   └── assets/
│       └── favicon.svg
├── database/
│   └── schema.sql            # Supabase SQL schema + sample data
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
└── SETUP.md                  # This file
```

---

## 🔒 Security Notes
- **Never** commit your `.env` file to git
- The `.gitignore` already excludes it
- The server uses the **service_role** key for admin operations and validates JWT tokens for every request
- Rate limiting is applied (200 req/15 min)

---

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot connect to server` | Is `npm run dev` running? Check port 3000 |
| `Invalid or expired token` | Log out and log back in |
| `User profile not found` | The user exists in Auth but not in `users` table — run the INSERT SQL |
| `Missing Supabase env vars` | Check your `.env` file values |
| Module not found | Run `npm install` |

---

## ✅ Features Checklist

- [x] Role-based auth (Admin, Teacher, Student)
- [x] Admin: CRUD for students, teachers, classes, subjects
- [x] Admin: Assign teachers to subjects
- [x] Admin: Global attendance report with filters
- [x] Teacher: Mark attendance with present/absent toggle
- [x] Teacher: Edit historical attendance
- [x] Teacher: Class attendance report with CSV export
- [x] Student: Personal attendance view
- [x] Student: Subject-wise percentage
- [x] Student: Monthly summary
- [x] Below 75% warning system
- [x] Duplicate attendance prevention (UNIQUE constraint)
- [x] CSV download for all reports
- [x] Search/filter by name, reg.no, date, subject, class
- [x] Responsive mobile design
- [x] Dark mode UI with glassmorphism
- [x] Loading states and error handling
- [x] Toast notifications

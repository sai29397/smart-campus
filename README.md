# 🎓 Smart Campus Communication Platform

A centralized, responsive web platform designed to streamline communication and academic subject coordination across Students, Faculty, and Campus Administration.

---

## 📁 Project Structure

```
campus/
├── backend/
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── Academic.js
│   │   └── User.js
│   ├── routes/
│   │   ├── academicRoutes.js
│   │   └── authRoutes.js
│   ├── .env
│   ├── package.json
│   └── server.js
│
└── smart-campus/
    ├── css/
    │   └── style.css
    ├── images/
    │   └── campus-logo.png
    ├── js/
    │   ├── admin.js
    │   ├── auth.js
    │   ├── faculty.js
    │   ├── script.js
    │   └── student.js
    ├── admin-dashboard.html
    ├── faculty-dashboard.html
    ├── index.html
    ├── login.html
    ├── register.html
    └── student-dashboard.html
```

---

## 🚀 Getting Started

### 1. Start the Backend API & Server

```bash
cd backend
npm install
node server.js
```

The server will start on `http://localhost:3000`:
- **Test Route**: `http://localhost:3000/`
- **Academic API**: `http://localhost:3000/api/academic`
- **Unified Frontend**: `http://localhost:3000/index.html`

---

### 2. Access the Dashboards

Open your browser to:
- **Homepage**: `http://localhost:3000/index.html`
- **Faculty Portal**: `http://localhost:3000/faculty-dashboard.html`
- **Student Portal**: `http://localhost:3000/student-dashboard.html`
- **Admin Portal**: `http://localhost:3000/admin-dashboard.html`
- **Login**: `http://localhost:3000/login.html`

---

## 🔑 Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Faculty** | `faculty@campus.edu` | `faculty123` |
| **Student** | `student@campus.edu` | `student123` |
| **Admin** | `admin@campus.edu` | `admin123` |

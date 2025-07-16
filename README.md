# 🏸 SportiVox Backend API

This is the backend server for **SportiVox**, a full-stack Sports Club Management System. It is built with **Node.js**, **Express**, **MongoDB**, and **Stripe** for handling court bookings, payments, membership, and more.

---

## 🚀 Features

- 🔐 User Authentication (Firebase)
- 👥 Role-based access (`user`, `member`, `admin`)
- 🏟️ Court management (CRUD)
- 📆 Booking system with approval flow
- 💳 Stripe payment integration
- 🧾 Payment history tracking
- 🧑‍🤝‍🧑 Member management
- 🎟️ Coupon/discount code system
- 📢 Announcement system
- 📦 Organized RESTful API structure

---

## 📁 Project Structure

├── server.js / index.js # Main server file
├── .env # Environment variables (ignored by git)
├── routes/
├── controllers/
└── models/

---

## 🛠️ Technologies Used

- **Node.js** + **Express.js**
- **MongoDB** (with MongoDB Atlas)
- **Stripe** (Payment Gateway)
- **Firebase Auth** (Client-side)
- **dotenv** (for environment variables)
- **CORS**, **body-parser**

---

## 🔐 Environment Variables (.env)

Create a `.env` file in your root directory:

```env
PORT=5000
DB_USER=db_username
DB_PASS=db_password
```

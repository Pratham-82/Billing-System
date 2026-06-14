# Wallpaper Shop Billing System

A MERN stack billing app for a wallpaper shop. Create bills for standard and custom wallpaper rolls, save customers and orders in MongoDB, and look up past orders by bill number or customer.

## Features

- **New Order** – choose **New Customer** or **Existing Customer**
- **Standard & custom rolls** – add wallpaper items with quantity, price, and customization notes
- **Auto bill number** – e.g. `WB-2026-0001`
- **Printable bill** – view and print after creating an order
- **Find orders** – search by bill number
- **Customer orders** – search customers and view all their past orders

## Tech Stack

- **MongoDB** – database
- **Express.js** – REST API
- **React + Vite** – frontend
- **Node.js** – runtime

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally, or a MongoDB Atlas connection string

## Setup

### 1. Install dependencies

```bash
npm run install-all
```

### 2. Configure MongoDB

Copy the example env file and set your MongoDB URI:

```bash
# server/.env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/wallpaper_billing
```

For MongoDB Atlas, use your Atlas connection string instead.

### 3. Run the app

**Option A – run both together (from project root):**

```bash
npm install
npm run dev
```

**Option B – run separately:**

```bash
# Terminal 1 – backend
cd server
npm run dev

# Terminal 2 – frontend
cd client
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers?search=` | List/search customers |
| GET | `/api/customers/:id` | Get one customer |
| POST | `/api/customers` | Create customer |
| GET | `/api/orders?search=&customerId=` | List/search orders |
| GET | `/api/orders/:id` | Get one order (bill) |
| POST | `/api/orders` | Create order and bill |

## Project Structure

```
billing system/
├── client/          # React frontend
├── server/          # Express API + MongoDB models
├── package.json     # Root scripts
└── README.md
```

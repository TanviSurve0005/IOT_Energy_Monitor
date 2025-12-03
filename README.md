# IoT Energy Monitor

A real-time **IoT-based Energy Monitoring System** built with React + TypeScript (Vite) on the frontend and a modular backend. Monitor energy consumption, visualize trends, manage devices, and receive alerts — all from a responsive web dashboard.

## Features

- Real-time energy usage tracking via MQTT/WebSocket
- Interactive dashboards with dynamic charts
- Device management (view status, toggle control)
- Customizable energy threshold alerts
- Historical data visualization (daily, weekly, monthly)
- Fully responsive UI (mobile + desktop)
- Secure login & user session management

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (blazing fast builds)
- Material UI (MUI) + Tailwind CSS (optional)
- Recharts / Chart.js for data visualization
- Axios + React Query / TanStack Query
- Zustand or Context API for state management
- React Router v6 for routing

### Backend (Node.js/Express)
- RESTful API + WebSocket/MQTT support
- MongoDB 
- JWT authentication

## Project Structure

```plaintext
IOT_Energy_Monitor/
├── frontend/
│   ├── public/                  # Static assets (logo, favicon, etc.)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── EnergyChart.tsx
│   │   │   ├── DeviceCard.tsx
│   │   │   ├── AlertBanner.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ...
│   │   ├── pages/               # Page components (DashboardPage, LoginPage, etc.)
│   │   ├── services/            # API calls & MQTT client
│   │   ├── hooks/               # Custom React hooks
│   │   ├── context/             # AuthContext, ThemeContext, etc.
│   │   ├── types/               # TypeScript interfaces & types
│   │   ├── App.tsx              # Main app with routing
│   │   └── main.tsx             # Entry point
│   ├── vite.config.ts
│   ├── package.json
│   └── .env.example
│
├── backend/                     # (Create this folder for server)
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── server.js
│
├── docs/                        # Documentation, diagrams, API specs
├── README.md
└── .gitignore

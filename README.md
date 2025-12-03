# IoT Energy Monitor

A real-time **IoT-based Energy Monitoring System** that allows users to track energy consumption of connected devices, visualize usage patterns, set alerts, and manage devices through a modern web dashboard.

## Features

- Real-time energy consumption monitoring
- Interactive dashboards with charts (line, bar, pie)
- Device management (view status, toggle on/off)
- Threshold-based alerts & notifications
- Historical data analysis (daily, weekly, monthly)
- Responsive design – works on desktop and mobile
- Secure user authentication

## Tech Stack

### Frontend
- **React.js** + **TypeScript**
- **Vite** (fast development & build tool)
- **Material UI (MUI)** – for beautiful UI components
- **Recharts** or **Chart.js** – data visualization
- **React Router** – client-side routing
- **Axios** – API communication
- **Zustand** or **Context API** – state management

### Backend (Separate or Integrated)
- Node.js + Express
- MongoDB 
- JWT authentication
  
## Project Structure
IOT_Energy_Monitor/
├── frontend/
│   ├── public/               # Static files
│   ├── src/
│   │   ├── components/       # Reusable UI components (Dashboard, Charts, DeviceCard, etc.)
│   │   ├── pages/            # Route pages
│   │   ├── services/         # API calls
│   │   ├── hooks/            # Custom React hooks
│   │   ├── context/          # Auth & global state
│   │   ├── types/            # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── backend/                  
├── docs/
├── README.md
└── .gitignore

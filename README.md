# Hierarchy Visualizer

A full-stack web application designed to parse, validate, and visualize directed acyclic graphs (Trees) and cyclic graphs (Cycles) from an array of node relationships (e.g., `A->B`, `C->D`). 

Built for the **Bajaj Finserv Health Dev Challenge (SRM Full Stack Engineering)**.

## Architecture

The project employs a split-deployment architecture for production robustness:

- **Frontend:** Built with **Next.js 14**, React, and CSS. Deployed on **Vercel**.
- **Backend:** Built with **Node.js** and **Express**. Deployed on **Render**.

### Key Features
- **Algorithm:** Uses iterative Depth First Search (DFS) for high-performance cycle detection, scaling without recursion stack overflow issues.
- **Visualizations:** Renders exact node mappings dynamically using SVG graph rendering directly in the DOM.
- **Robustness:** Strict `400 Bad Request` schema enforcement for malformed node requests.
- **Native Design:** A highly professional, solid-color structural SaaS design schema.

## Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn

### Installation
Clone the repository, then install dependencies for both the frontend and the standalone backend.

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
```

### Running Locally
To run the full stack locally, start both the Next.js development server and the Express backend.

```bash
# In the root directory (Frontend on port 3000)
npm run dev

# In a new terminal, run the backend (Backend on port 3001)
cd server
node index.js
```

### Environment Variables
For production deployment, ensure the Vercel frontend is pointing to the Render backend by setting the API URL.

**.env.production (Frontend)**
```env
NEXT_PUBLIC_API_URL=https://bfhl-api-ibc9.onrender.com/bfhl
```

## API Specifications

### `POST /bfhl`
Processes the incoming node relations and returns trees, cycles, and invalid configurations.
- **Request Body:** `{ "data": ["A->B", "X->Y"] }`
- **Response Structure:** Includes User Identity, Valid Hierarchies, Invalid Entries, Duplicate Edges, and a Statistical Summary.

### `GET /bfhl`
Returns a strict `{ "operation_code": 1 }` to prove API liveness.

## Author
Rohan Singh Aswal

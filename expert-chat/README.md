# ScholarSync Chat Platform

A real-time chat + video conferencing platform built with the MERN stack, designed to integrate seamlessly with ScholarSync. Subject experts can receive incoming sessions from students, chat in real time, share files, and conduct video calls — all in one place.

---

## 🧱 Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | React 18, React Router v6, CSS Modules  |
| Backend      | Node.js, Express.js                     |
| Database     | MongoDB + Mongoose                      |
| Real-time    | Socket.IO (chat) + WebRTC (video)       |
| Auth         | JWT (experts only)                      |
| File uploads | Multer (local disk, easily swappable)   |
| Fonts        | Space Mono + DM Sans (Google Fonts)     |

---

## 📁 Folder Structure

```
scholarsync-chat/
├── backend/
│   ├── config/
│   │   ├── db.js               # MongoDB connection
│   │   └── socket.js           # Socket.IO event handlers
│   ├── controllers/
│   │   ├── authController.js   # Expert login/logout/profile
│   │   ├── chatController.js   # Rooms, messages, file upload
│   │   ├── connectController.js# ScholarSync integration API
│   │   └── expertController.js # Public expert listing
│   ├── middleware/
│   │   ├── authMiddleware.js   # JWT verification
│   │   └── uploadMiddleware.js # Multer file handling
│   ├── models/
│   │   ├── Expert.js           # Expert schema
│   │   ├── ChatRoom.js         # Room schema
│   │   └── Message.js          # Message schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── connectRoutes.js    # GET /api/connect?subject=...
│   │   └── expertRoutes.js
│   ├── scripts/
│   │   └── seedExperts.js      # Seeds all 10 experts
│   ├── uploads/                # Uploaded files stored here
│   ├── .env.example
│   ├── package.json
│   └── server.js               # Entry point
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Chat/
    │   │   │   ├── ChatPanel.js        # Chat UI + file upload
    │   │   │   └── ChatPanel.module.css
    │   │   └── Video/
    │   │       ├── VideoPanel.js       # WebRTC video UI
    │   │       └── VideoPanel.module.css
    │   ├── context/
    │   │   ├── AuthContext.js          # Expert auth state
    │   │   └── SocketContext.js        # Socket.IO connection
    │   ├── hooks/
    │   │   └── useWebRTC.js            # WebRTC logic
    │   ├── pages/
    │   │   ├── LoginPage.js            # Expert login
    │   │   ├── LoginPage.module.css
    │   │   ├── DashboardPage.js        # Expert dashboard
    │   │   ├── DashboardPage.module.css
    │   │   ├── ChatRoomPage.js         # Main chat + video room
    │   │   └── ChatRoomPage.module.css
    │   ├── styles/
    │   │   └── globals.css             # Design system + CSS vars
    │   ├── utils/
    │   │   └── api.js                  # Axios instance
    │   ├── App.js
    │   └── index.js
    ├── .env.example
    └── package.json
```

---

## ⚙️ Setup Instructions

### Prerequisites

- Node.js ≥ 18
- MongoDB running locally (or a MongoDB Atlas URI)

---

### 1. Clone & Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### 2. Environment Variables

**Backend** — create `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/scholarsync_chat
JWT_SECRET=your_super_secret_key_change_this
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

**Frontend** — create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

### 3. Seed the 10 Experts

```bash
cd backend
node scripts/seedExperts.js
```

This creates all 10 subject experts. Default password for all: `expert@123`

Expert emails follow the pattern `<subject>.expert@scholarsync.com`:

| Subject | Email |
|---------|-------|
| Computer Networks | cn.expert@scholarsync.com |
| Operating Systems | os.expert@scholarsync.com |
| DBMS | dbms.expert@scholarsync.com |
| Software Engineering | se.expert@scholarsync.com |
| DSA | dsa.expert@scholarsync.com |
| Greedy | greedy.expert@scholarsync.com |
| Math | math.expert@scholarsync.com |
| Binary Search | bs.expert@scholarsync.com |
| Two Pointers | tp.expert@scholarsync.com |
| Graph | graph.expert@scholarsync.com |

---

### 4. Run the App

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm start
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## 🔗 ScholarSync Integration

### How it works

ScholarSync sends a single GET request to generate a new chat room:

```
GET http://localhost:5000/api/connect?subject=greedy
```

The backend:
1. Maps the subject slug to the correct expert
2. Creates a new unique `roomId` (UUID)
3. Returns a JSON response with the chat URL

**Response:**

```json
{
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "chatUrl": "/chat/550e8400-e29b-41d4-a716-446655440000",
  "fullUrl": "http://localhost:3000/chat/550e8400-e29b-41d4-a716-446655440000",
  "expert": {
    "name": "Mr. Vikram Singh",
    "subject": "Greedy Algorithms",
    "isOnline": false
  }
}
```

**Redirect the user to `fullUrl`** — no login required. They land directly in the chat room.

### Accepted subject values

The API accepts flexible subject names:

```
greedy, math, graph, graphs, dsa, dbms, os, cn,
binary_search, binary-search, two_pointers, two-pointers,
computer_networks, operating_systems, software_engineering,
data_structures_and_algorithms, ...
```

### Test the API manually

```bash
curl "http://localhost:5000/api/connect?subject=greedy"
curl "http://localhost:5000/api/connect?subject=dsa"
curl "http://localhost:5000/api/connect?subject=graph"
```

---

## 🔴 Real-Time System Architecture

### Socket.IO (Chat)

All real-time chat events flow through Socket.IO:

| Event (emit) | Direction | Description |
|---|---|---|
| `joinRoom` | client → server | Join a chat room |
| `sendMessage` | client → server | Send a message (saved to DB) |
| `receiveMessage` | server → client | Broadcast new message to room |
| `typing` | client → server | Notify peer of typing |
| `userTyping` | server → client | Show typing indicator |
| `stopTyping` | client → server | Stop typing indicator |
| `userWaiting` | server → client | Alert expert of new user |
| `expertJoined` | server → client | Alert user that expert is here |
| `roomStatus` | server → client | Online status of both participants |
| `peerDisconnected` | server → client | Notify when someone leaves |

### WebRTC (Video)

WebRTC uses a signaling server (Socket.IO) to establish a peer-to-peer connection:

```
Caller                    Server (signaling)          Callee
  |                             |                        |
  |-- webrtc:offer -----------> |                        |
  |                             |-- webrtc:offer ------> |
  |                             |                        |
  |                             | <-- webrtc:answer ----- |
  | <-- webrtc:answer --------- |                        |
  |                             |                        |
  |-- webrtc:ice-candidate ---> | -- webrtc:ice-cand --> |
  |                             |                        |
  |<======= P2P Video Stream ========================>|
```

Once the answer is exchanged, video/audio flows **directly peer-to-peer** — no server bandwidth used.

**STUN servers used:** `stun.l.google.com:19302` (free, no setup required)

For production, add TURN server credentials for users behind NAT/firewalls.

---

## 👤 User Flows

### Normal User (from ScholarSync)
1. ScholarSync calls `GET /api/connect?subject=greedy`
2. Gets back a `fullUrl`
3. User is redirected to `/chat/<roomId>`
4. No login required — they're in the chat immediately
5. If expert is online → chat starts right away
6. If expert is offline → sees "Waiting for expert" banner
7. Returning to the same link shows full message history

### Subject Expert
1. Navigates to `/login` and signs in with email + password
2. Sees the Dashboard with all their past sessions
3. Gets real-time notification when a new user is waiting
4. Clicks "Join Now" to open the chat room
5. Can start a video call by clicking "Start Call"
6. Can edit their name and description from the dashboard

---

## 📁 File Uploads

Supported file types:
- **Images**: JPG, PNG, GIF, WebP (displayed inline in chat)
- **Documents**: PDF, DOC, DOCX, TXT (shown as download links)

Max file size: **10 MB**

Files are stored in `backend/uploads/`. For production, swap Multer's disk storage for **AWS S3** or **Cloudinary** by updating `uploadMiddleware.js`.

---

## ✏️ Adding / Editing Experts

### Add a new expert

Edit `backend/scripts/seedExperts.js` and add to the `experts` array:

```js
{
  name: 'Dr. New Expert',
  subject: 'graph',           // must match enum in Expert.js
  subjectLabel: 'Graph Algorithms',
  description: 'Expert in...',
  email: 'graph.expert@scholarsync.com',
  password: 'expert@123',
}
```

Re-run: `node scripts/seedExperts.js`

### Edit an expert's name/description

Experts can edit their own profile from the Dashboard (Edit Profile button), or you can use MongoDB directly:

```js
db.experts.updateOne({ email: "graph.expert@scholarsync.com" }, {
  $set: { name: "New Name", description: "New description" }
});
```

---

## 🔒 Security Notes

- Change `JWT_SECRET` to a strong random string in production
- Add rate limiting to `/api/connect` to prevent abuse
- Consider adding an API key for ScholarSync-to-backend calls
- For production video calls, add TURN server support

---

## 🚀 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use MongoDB Atlas instead of local MongoDB
- [ ] Set a strong `JWT_SECRET`
- [ ] Replace `CLIENT_URL` with your actual frontend domain
- [ ] Swap Multer disk storage for S3/Cloudinary
- [ ] Add TURN server for WebRTC (Twilio, Metered, etc.)
- [ ] Serve React build via Express or a CDN
- [ ] Enable HTTPS (required for WebRTC in browsers)

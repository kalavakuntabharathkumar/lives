# LiveRoom — Real-Time Chat Rooms

Real-time chat rooms built with Socket.io, Firebase phone OTP auth, and
Firestore persistence, deployable to GCP Cloud Run.

## Features
- Join any room by ID and chat instantly over WebSockets (Socket.io)
- Firebase phone number OTP sign-in (no passwords)
- Online user list + "is typing..." indicator
- Optional Firestore-backed message history (works fine without it too)
- Dockerized for one-command deploy to Cloud Run

## Local setup
```bash
npm install
npm start
# open http://localhost:8080
```

## Firebase setup
1. Create a Firebase project → enable **Phone** sign-in under Authentication.
2. Copy your web config into `public/index.html` (`firebaseConfig`).
3. (Optional, for chat history) create a service account with Firestore
   access and set it as an env var before starting the server:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"
   ```
   Without this env var, the app still works — messages just aren't saved.

## Deploy to Cloud Run
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/liveroom
gcloud run deploy liveroom \
  --image gcr.io/YOUR_PROJECT/liveroom \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"
```

## Project structure
```
liveroom/
├── server.js          # Express + Socket.io backend
├── public/index.html  # Chat UI + Firebase phone OTP auth
├── package.json
├── Dockerfile
└── README.md
```

## Notes
- The Flutter client can reuse the same `server.js` backend — just connect
  a `socket_io_client` Flutter package to the deployed Cloud Run URL and
  use `firebase_auth` for phone sign-in.

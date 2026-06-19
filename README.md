
  # Emergency Response App UI

  This is a code bundle for Emergency Response App UI. The latest prototype is available in [Figma](https://www.figma.com/proto/8akhJseD0KGlak6lWqCpdP/P2A-Hackathon-ready?node-id=55-165&t=zlFaxAU5O0dmJAXw-1).

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Firebase setup

The app uses Firebase when the `VITE_FIREBASE_*` variables are configured, and falls back to local storage otherwise.

1. Create a Firebase project and Web App.
2. Enable Cloud Firestore. Cloud Storage is not required for the no-cost prototype.
3. Copy `.env.example` to `.env.local` and fill in the Firebase Web App configuration.
4. Add the same `VITE_FIREBASE_*` variables in Vercel.
5. Install the Firebase CLI and deploy the rules with `firebase deploy --only firestore:rules`.

Sanitized report thumbnails are compressed below 220 KB and stored inline in Firestore. The included rules require Firebase Authentication and apply report-owner or emergency-service access controls.

## Incident Management backend

The Vercel backend exposes:

- `GET /api/health` for backend readiness.
- `GET /api/incidents` for incident listing.
- `POST /api/incidents` for validated incident creation.
- `PATCH /api/incidents` for controlled dispatch status transitions and audit trail updates.
- `DELETE /api/incidents` for incident deletion.

To activate Firebase Admin on Vercel:

1. Open Firebase Console, then **Project settings → Service accounts**.
2. Generate a new private key.
3. Add the entire downloaded JSON as the sensitive Vercel environment variable `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Redeploy the latest production deployment.

Never commit the service account JSON to Git.

## Safety and mentor-feedback controls

See [TECHNICAL_VALIDATION.md](./TECHNICAL_VALIDATION.md) for the response-time simulation, low-confidence human fallback, permanent image anonymization, offline queue, override audit trail, reflection checks, evidence scoring, and ASEAN interoperability boundaries.

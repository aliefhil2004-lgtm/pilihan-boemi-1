
  # Emergency Response App UI

  This is a code bundle for Emergency Response App UI. The original project is available at https://www.figma.com/design/CJvN4n0b4HsTI9DvCslAsr/Emergency-Response-App-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Firebase setup

The app uses Firebase when the `VITE_FIREBASE_*` variables are configured, and falls back to local storage otherwise.

1. Create a Firebase project and Web App.
2. Enable Cloud Firestore and Firebase Storage.
3. Copy `.env.example` to `.env.local` and fill in the Firebase Web App configuration.
4. Add the same `VITE_FIREBASE_*` variables in Vercel.
5. Install the Firebase CLI and deploy the prototype rules with `firebase deploy --only firestore:rules,storage`.

The included rules allow public prototype access. Replace them with Firebase Authentication and role-based rules before production.

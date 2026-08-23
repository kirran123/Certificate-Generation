const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let db, authApp;

const initFirebase = () => {
  if (getApps().length === 0) {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : process.env.FIREBASE_SERVICE_ACCOUNT;
    } else {
      try {
        serviceAccount = require('./serviceAccountKey.json');
      } catch (e) {
        throw new Error(
          'Firebase: No service account found. Set FIREBASE_SERVICE_ACCOUNT env var or add backend/config/serviceAccountKey.json'
        );
      }
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
    });

    db = getFirestore(app);
    authApp = getAuth(app);
    console.log('✅ Firebase Admin initialized successfully!');
  } else {
    db = getFirestore();
    authApp = getAuth();
  }

  return { db, auth: authApp };
};

const getDb = () => {
  if (!db) initFirebase();
  return db;
};

const getAuthService = () => {
  if (!authApp) initFirebase();
  return authApp;
};

module.exports = { initFirebase, getDb, getAuth: getAuthService };

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let appCheck: AppCheck | undefined;

// Initialize App Check on the client side
if (typeof window !== "undefined") {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const enableAppCheck = siteKey && (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_APPCHECK === 'true');
  
  if (enableAppCheck) {
    // In development, enable the debug token
    if (process.env.NODE_ENV === 'development') {
      // This must be set BEFORE initializeAppCheck
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      console.log('🔧 App Check: Development mode detected. Using Debug Provider.');
    }

    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      console.log('✅ Firebase App Check initialized successfully');
    } catch (error: any) {
      if (error?.code !== 'app-check/already-initialized') {
        console.error('❌ Firebase App Check failed to initialize:', error);
      }
    }
  }
}

export { auth, db, appCheck };

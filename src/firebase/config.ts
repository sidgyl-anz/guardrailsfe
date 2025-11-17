const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!apiKey) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY environment variable.');
}

export const firebaseConfig = {
  "projectId": "studio-5074116747-4d87f",
  "appId": "1:265936168898:web:1c867261d3713d0b60585b",
  "apiKey": apiKey,
  "authDomain": "studio-5074116747-4d87f.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "265936168898"
};

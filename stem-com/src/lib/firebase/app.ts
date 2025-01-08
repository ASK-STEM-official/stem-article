import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./config.ts";

// Initialize Firebase app instance
export const app = initializeApp(firebaseConfig);

console.log("Firebase app initialized");
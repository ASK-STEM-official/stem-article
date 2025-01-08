import { getFirestore } from "firebase/firestore";
import { app } from "./app.ts";

// Initialize Firestore
export const db = getFirestore(app);
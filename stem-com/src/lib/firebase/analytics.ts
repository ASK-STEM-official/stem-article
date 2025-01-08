import { getAnalytics } from "firebase/analytics";
import { app } from "./app";

// Initialize Analytics
export const analytics = getAnalytics(app);
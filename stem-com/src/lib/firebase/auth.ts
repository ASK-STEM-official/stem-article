import { getAuth, signInWithPopup, GithubAuthProvider, type User } from "firebase/auth";
import { app } from "./app";

// Initialize Firebase Authentication
export const auth = getAuth(app);

// GitHub authentication function
export const signInWithGitHub = async (): Promise<User | null> => {
  const provider = new GithubAuthProvider();
  provider.addScope("read:org");
  
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error during GitHub login:", error);
    return null;
  }
};
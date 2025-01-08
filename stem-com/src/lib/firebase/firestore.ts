// src/lib/firestore.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./db.ts"; // Firebaseの初期化が行われているファイル

// ユーザーのテーマを取得
export const getUserTheme = async (userId: string): Promise<string | null> => {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      console.log("User theme fetched:", data.theme);
      return data.theme || null;
    }
    console.log("User document does not exist.");
    return null;
  } catch (error) {
    console.error("Error fetching user theme:", error);
    return null;
  }
};

// ユーザーのテーマを設定
export const setUserTheme = async (userId: string, theme: string): Promise<void> => {
  try {
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, { theme }, { merge: true });
    console.log("User theme set to:", theme);
  } catch (error) {
    console.error("Error setting user theme:", error);
  }
};

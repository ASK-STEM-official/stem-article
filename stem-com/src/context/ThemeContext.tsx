// src/context/ThemeContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db"; // 必要に応じてパスを調整

interface ThemeContextProps {
  theme: string;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextProps>({
  theme: "light",
  toggleTheme: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<string>("light");
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userTheme = userDoc.data().theme || "light";
          setTheme(userTheme);
          applyTheme(userTheme);
        } else {
          // 初回ログイン時にテーマを設定
          setTheme("light");
          applyTheme("light");
          await setDoc(userDocRef, { theme: "light" }, { merge: true });
        }
      } else {
        setTheme("light");
        applyTheme("light");
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const applyTheme = (theme: string) => {
    document.documentElement.className = theme;
  };

  const toggleTheme = async () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    applyTheme(newTheme);

    const user = auth.currentUser;
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { theme: newTheme }, { merge: true });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

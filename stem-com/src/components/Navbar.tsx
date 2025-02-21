// Navbar.tsx
import React, { useState, useLayoutEffect, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  X,
  BookOpen,
  LogOut,
  Sun,
  Moon,
  User as UserIcon,
  PenLine,
  TrendingUp,
} from "lucide-react";
import { getUserTheme, setUserTheme } from "../lib/firebase/firestore.ts";

interface UserData {
  uid: string;
  avatarUrl?: string;
  displayName?: string;
}

interface NavbarProps {
  user: UserData | null;
  onLogout: () => void;
  children: React.ReactNode;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, children }) => {
  // 初期状態は localStorage に保存されたテーマを利用する
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("theme") === "dark";
  });
  const [menuOpen, setMenuOpen] = useState<boolean>(window.innerWidth >= 768);

  // useLayoutEffect を使い、レンダリング前にテーマを適用
  useLayoutEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // ユーザーがログインしている場合、Firestore からの取得を試みる
  useEffect(() => {
    const initializeTheme = async () => {
      if (user) {
        const storedTheme = localStorage.getItem("theme");
        if (!storedTheme) {
          // localStorage になければ Firestore から取得
          const userTheme = await getUserTheme(user.uid);
          if (userTheme === "dark") {
            setDarkMode(true);
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
          } else {
            setDarkMode(false);
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
          }
        }
      }
    };
    initializeTheme();

    // 画面幅によるサイドバー表示の更新
    const handleResize = () => {
      setMenuOpen(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [user]);

  const toggleDarkMode = async () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark", !darkMode);
    if (user) {
      await setUserTheme(user.uid, darkMode ? "light" : "dark");
    } else {
      localStorage.setItem("theme", darkMode ? "light" : "dark");
    }
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const getInitials = (name: string | undefined) => {
    if (!name) return "";
    const names = name.split(" ");
    return names.length === 1
      ? names[0].charAt(0).toUpperCase()
      : names.map((n) => n.charAt(0).toUpperCase()).join("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 上部固定のナビバー */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white shadow-lg dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <button onClick={toggleMenu} className="focus:outline-none">
                {menuOpen ? (
                  <X className="h-8 w-8" />
                ) : (
                  <Menu className="h-8 w-8" />
                )}
              </button>
              <Link to="/" className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8" />
                <span className="font-bold text-xl">
                  STEM研究部記事投稿サイト
                </span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={toggleDarkMode}>
                {darkMode ? (
                  <Sun className="h-6 w-6" />
                ) : (
                  <Moon className="h-6 w-6" />
                )}
              </button>
              {user ? (
                <Link to={`/users/${user.uid}`} className="flex items-center space-x-2">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName || "User"}
                      className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600 shadow-md"
                    />
                  ) : user.displayName ? (
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-300 text-gray-700 border-2 border-indigo-600 shadow-md">
                      <span className="font-medium">
                        {getInitials(user.displayName)}
                      </span>
                    </div>
                  ) : (
                    <UserIcon className="h-8 w-8 text-gray-400" />
                  )}
                  {user.displayName && (
                    <span className="font-medium">{user.displayName}</span>
                  )}
                </Link>
              ) : (
                <UserIcon className="h-8 w-8 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 pt-16 transition-all duration-300">
        <div
          className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-indigo-700 dark:bg-gray-900 transition-transform duration-300 ease-in-out ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-4">
            <Link
              to="/add-article"
              className="block py-2 px-4 text-white hover:bg-indigo-700 transition-colors"
            >
              <PenLine className="h-5 w-5 inline mr-2" />
              新規投稿
            </Link>
            <Link
              to="/rank"
              className="block py-2 px-4 text-white hover:bg-indigo-700 transition-colors"
            >
              <TrendingUp className="h-5 w-5 inline mr-2" />
              ランキング
            </Link>
            <button
              onClick={onLogout}
              className="mt-4 flex items-center space-x-2 w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>ログアウト</span>
            </button>
          </div>
        </div>
        <main
          className={`flex-1 transition-all duration-300 ${
            menuOpen ? "ml-64" : "ml-0"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Navbar;

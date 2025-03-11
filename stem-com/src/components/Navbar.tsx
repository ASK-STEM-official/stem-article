// Navbar.tsx
// ユーザー情報と各種アイコンを表示するナビバーコンポーネント。画面上部に固定表示されます。

import React, { useState, useEffect } from "react";
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

// ユーザー情報の型
interface UserData {
  uid: string;
  avatarUrl?: string;
  displayName?: string;
}

// Navbarコンポーネントが受け取るPropsの型
interface NavbarProps {
  user: UserData | null;
  onLogout: () => void;
  children: React.ReactNode; // メインコンテンツを子要素として受け取る
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  /**
   * 初期化時:
   *  1. ログインしていればFirestoreからユーザーのテーマを取得
   *  2. 未ログインならlocalStorageからテーマを取得
   *  3. 画面幅によってサイドバー初期表示を設定
   *  4. リサイズ時のイベントを登録し、大画面なら自動的にサイドバーを開く
   */
  useEffect(() => {
    const initializeTheme = async () => {
      if (user) {
        const userTheme = await getUserTheme(user.uid);
        if (userTheme === "dark") {
          setDarkMode(true);
          document.documentElement.classList.add("dark");
        } else {
          setDarkMode(false);
          document.documentElement.classList.remove("dark");
        }
      } else {
        const storedTheme = localStorage.getItem("theme");
        setDarkMode(storedTheme === "dark");
        document.documentElement.classList.toggle("dark", storedTheme === "dark");
      }
    };
    initializeTheme();

    // 初期表示時にウィンドウサイズに応じてサイドバーの状態を設定
    if (window.innerWidth >= 768) {
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }

    // リサイズ時にサイドバーの状態を自動で更新
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMenuOpen(true);
      } else {
        setMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [user]);

  /**
   * ダークモード切り替え関数
   *  1. darkModeを反転
   *  2. documentElementに.darkクラスを付け外し
   *  3. ログイン中ならFirestoreに保存、未ログインならlocalStorageに保存
   */
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
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names.map((n) => n.charAt(0).toUpperCase()).join("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ナビバー本体（上部固定） */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white shadow-lg dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 左側: ハンバーガーメニュー + タイトル */}
            <div className="flex items-center space-x-3">
              <button onClick={toggleMenu} className="focus:outline-none">
                {menuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
              </button>
              <Link to="/" className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8" />
                <span className="font-bold text-xl">STEM研究部記事投稿サイト</span>
              </Link>
            </div>
            {/* 右側: ダークモードボタン + ユーザー情報 */}
            <div className="flex items-center space-x-4">
              <button onClick={toggleDarkMode}>
                {darkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
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
                      <span className="font-medium">{getInitials(user.displayName)}</span>
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

      {/* レイアウト全体 */}
      <div className="flex flex-1 pt-16 transition-all duration-300">
        {/* サイドバー */}
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
        {/* メインコンテンツ */}
        <main className={`flex-1 transition-all duration-300 ${menuOpen ? "ml-64" : "ml-0"}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Navbar;

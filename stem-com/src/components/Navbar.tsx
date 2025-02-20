// Navbar.tsx
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
// Firestoreにユーザーのテーマを保存・取得するユーティリティ関数
import { getUserTheme, setUserTheme } from "../lib/firebase/firestore.ts";

// ユーザーデータ型
interface UserData {
  uid: string;
  avatarUrl?: string;
  displayName?: string;
}

// Navbarコンポーネントに渡すpropsの型
interface NavbarProps {
  user: UserData | null;
  onLogout: () => void;
  children: React.ReactNode;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, children }) => {
  // ① サイドバーの開閉状態を管理。true で「開いた状態」にしておく
  const [menuOpen, setMenuOpen] = useState<boolean>(true);

  // ② ダークモードの状態を管理
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // コンポーネントマウント時にテーマを初期化
  useEffect(() => {
    const initializeTheme = async () => {
      if (user) {
        // ログイン中ユーザーの場合は Firestore からテーマを取得
        const userTheme = await getUserTheme(user.uid);
        if (userTheme === "dark") {
          setDarkMode(true);
          document.documentElement.classList.add("dark");
          document.body.classList.add("dark");
        } else {
          setDarkMode(false);
          document.documentElement.classList.remove("dark");
          document.body.classList.remove("dark");
        }
      } else {
        // 未ログイン時は localStorage の設定を利用
        const storedTheme = localStorage.getItem("theme");
        const isDark = storedTheme === "dark";
        setDarkMode(isDark);
        document.documentElement.classList.toggle("dark", isDark);
        document.body.classList.toggle("dark", isDark);
      }
    };
    initializeTheme();
  }, [user]);

  // ダークモードとライトモードの切り替え
  const toggleDarkMode = async () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    document.documentElement.classList.toggle("dark", newDarkMode);
    document.body.classList.toggle("dark", newDarkMode);

    if (user) {
      // ログイン中なら Firestore に保存
      await setUserTheme(user.uid, newDarkMode ? "dark" : "light");
    } else {
      // 未ログインなら localStorage に保存
      localStorage.setItem("theme", newDarkMode ? "dark" : "light");
    }
  };

  // ハンバーガーメニューの開閉を切り替える
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  // ユーザー名からイニシャルを生成する関数
  const getInitials = (name: string | undefined) => {
    if (!name) return "";
    const names = name.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return names.map((n) => n.charAt(0).toUpperCase()).join("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 上部ナビゲーションバー */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white shadow-lg dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              {/* PC版でも常にハンバーガーメニューアイコンを表示 */}
              <button onClick={toggleMenu} className="focus:outline-none">
                {menuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
              </button>
              <Link to="/" className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8" />
                <span className="font-bold text-xl">STEM研究部記事投稿サイト</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {/* ダークモード切り替えボタン */}
              <button onClick={toggleDarkMode}>
                {darkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
              </button>
              {user ? (
                <Link to={`/users/${user.uid}`} className="flex items-center space-x-2">
                  {/* アバター画像 or イニシャル or アイコン */}
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
                  {/* 表示名 */}
                  {user.displayName && <span className="font-medium">{user.displayName}</span>}
                </Link>
              ) : (
                <UserIcon className="h-8 w-8 text-gray-400" />
              )}
              {/* PC版ログアウトボタン（md以上で表示） */}
              <button
                onClick={onLogout}
                className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* サイドバー + メインコンテンツ レイアウト */}
      <div className="flex flex-1 pt-16 transition-all duration-300">
        {/* サイドバー。menuOpen が false の時は左に隠す */}
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
            {/* モバイル版ログアウトボタン（md未満で表示） */}
            <button
              onClick={onLogout}
              className="mt-4 block w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 transition-colors md:hidden"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* メインコンテンツ。サイドバーが開いているときは左に64px(16rem)のマージンを取る */}
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

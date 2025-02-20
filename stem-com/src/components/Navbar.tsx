// Navbar.tsx
// ユーザー情報と各種アイコンを表示するナビバーコンポーネント。画面上部に固定表示されます。

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  X,
  PenLine,
  BookOpen,
  LogOut,
  Sun,
  Moon,
  User as UserIcon,
  TrendingUp,
} from "lucide-react";

// ユーザー情報の型
interface UserData {
  uid: string;
  avatarUrl?: string;
  displayName?: string;
}

// 親コンポーネントから受け取るPropsの型
interface NavbarProps {
  user: UserData | null;         // ログインユーザー情報
  onLogout: () => void;          // ログアウト処理
  toggleDarkMode: () => void;    // 親で定義済みのダークモード切り替え関数
  darkMode: boolean;             // 親で管理しているダークモード状態
}

const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  toggleDarkMode,
  darkMode,
}) => {
  // ハンバーガーメニューの開閉状態
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // メニューの開閉トグル
  const handleToggleMenu = () => setMenuOpen(!menuOpen);

  return (
    // 画面上部に固定: fixed, z-50
    <nav className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white shadow-lg dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ナビバー本体 */}
        <div className="flex items-center justify-between h-16">
          {/* 左側: ハンバーガーメニュー + サイトタイトル */}
          <div className="flex items-center space-x-3">
            <button onClick={handleToggleMenu} className="focus:outline-none">
              {menuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
            </button>
            <Link to="/" className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8" />
              <span className="font-bold text-xl">STEM研究部記事投稿サイト</span>
            </Link>
          </div>

          {/* 右側: ダークモードボタン + ユーザー情報 */}
          <div className="flex items-center space-x-4">
            {/* ダークモード切り替え */}
            <button onClick={toggleDarkMode}>
              {darkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>

            {/* ユーザーがログイン中かどうかで分岐 */}
            {user ? (
              <Link to={`/users/${user.uid}`} className="flex items-center space-x-2">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName || "User"}
                    className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600 shadow-md"
                  />
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

      {/* メニュー（スマホ/PC共通） */}
      <div
        className={`fixed top-16 left-0 w-64 bg-indigo-700 dark:bg-gray-900 transition-transform duration-300 ease-in-out transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } p-4 flex flex-col h-[calc(100vh-4rem)]`}
      >
        {/* 新規投稿 */}
        <Link
          to="/add-article"
          className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
        >
          <PenLine className="h-5 w-5" />
          <span>新規投稿</span>
        </Link>

        {/* ランキング */}
        <Link
          to="/rank"
          className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
        >
          <TrendingUp className="h-5 w-5" />
          <span>ランキング</span>
        </Link>

        {/* 余白を埋めて下部にログアウトボタンを固定 */}
        <div className="flex-grow"></div>

        {/* ログアウト */}
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>ログアウト</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

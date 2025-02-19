// Navbar.tsx
// ユーザー情報と各種アイコンを表示するナビバーコンポーネント。画面上部に固定表示されます。

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import { getUserTheme, setUserTheme } from '../lib/firebase/firestore.ts';

interface UserData {
  uid: string;
  avatarUrl?: string;
  displayName?: string;
}

interface NavbarProps {
  user: UserData | null;   // ユーザー情報の型を明確に
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const initializeTheme = async () => {
      if (user) {
        // ログイン中のユーザー用: Firestore からテーマを取得
        const userTheme = await getUserTheme(user.uid);
        if (userTheme === 'dark') {
          setDarkMode(true);
          document.documentElement.classList.add('dark');
        } else {
          setDarkMode(false);
          document.documentElement.classList.remove('dark');
        }
      } else {
        // ログインしていない場合: localStorage からテーマを取得
        const storedTheme = localStorage.getItem('theme');
        setDarkMode(storedTheme === 'dark');
        document.documentElement.classList.toggle('dark', storedTheme === 'dark');
      }
    };
    initializeTheme();
  }, [user]);

  const toggleDarkMode = async () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark', !darkMode);
    if (user) {
      // ログイン中なら Firestore にテーマを保存
      await setUserTheme(user.uid, darkMode ? 'light' : 'dark');
    } else {
      // 未ログインなら localStorage に保存
      localStorage.setItem('theme', darkMode ? 'light' : 'dark');
    }
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    // fixedクラスを追加して画面上部に固定、z-50で重なり順を調整
    <nav className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white shadow-lg dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ハンバーガーメニューとタイトル */}
          <div className="flex items-center space-x-3">
            <button onClick={toggleMenu} className="focus:outline-none">
              {menuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
            </button>
            <Link to="/" className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8" />
              <span className="font-bold text-xl">STEM研究部記事投稿サイト</span>
            </Link>
          </div>
          
          {/* アイコン配置 */}
          <div className="flex items-center space-x-4">
            <button onClick={toggleDarkMode}>
              {darkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>
            
            {/* ユーザーがログイン中の場合 */}
            {user ? (
              <Link to={`/users/${user.uid}`} className="flex items-center space-x-2">
                {/* アバター or デフォルトアイコン */}
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName || 'User'}
                    className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600 shadow-md"
                  />
                ) : (
                  <UserIcon className="h-8 w-8 text-gray-400" />
                )}
                {/* ユーザー名を表示（存在する場合） */}
                {user.displayName && (
                  <span className="font-medium">{user.displayName}</span>
                )}
              </Link>
            ) : (
              // ログインしていない場合
              <UserIcon className="h-8 w-8 text-gray-400" />
            )}
          </div>
        </div>
      </div>
      
      {/* メニュー（スマートフォンと同じ表示をPCにも適用） */}
      <div
        className={`fixed top-16 left-0 w-64 bg-indigo-700 dark:bg-gray-900 transition-transform duration-300 ease-in-out transform ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        } p-4 flex flex-col h-[calc(100vh-4rem)]`}
      >
        <Link
          to="/add-article"
          className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
        >
          <PenLine className="h-5 w-5" />
          <span>新規投稿</span>
        </Link>
        <Link
          to="/rank"
          className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
        >
          <TrendingUp className="h-5 w-5" />
          <span>ランキング</span>
        </Link>
        <div className="flex-grow"></div>
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

// src/components/Navbar.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PenLine, BookOpen, LogOut, Sun, Moon } from 'lucide-react';
import { getUserTheme, setUserTheme } from '../lib/firestore'; // 追加

interface NavbarProps {
  user: any; // Firebase User型に変更可能
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // テーマ設定の初期化
  useEffect(() => {
    const initializeTheme = async () => {
      if (user) {
        // Firestoreからユーザーのテーマ設定を取得
        const userTheme = await getUserTheme(user.uid);
        if (userTheme === 'dark') {
          setDarkMode(true);
          document.documentElement.classList.add('dark');
        } else if (userTheme === 'light') {
          setDarkMode(false);
          document.documentElement.classList.remove('dark');
        } else {
          // デフォルト設定（システム設定に基づく）
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setDarkMode(prefersDark);
          if (prefersDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } else {
        // ログインしていない場合、ローカルストレージからテーマ設定を取得
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark') {
          setDarkMode(true);
          document.documentElement.classList.add('dark');
        } else if (storedTheme === 'light') {
          setDarkMode(false);
          document.documentElement.classList.remove('dark');
        } else {
          // デフォルト設定（システム設定に基づく）
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setDarkMode(prefersDark);
          if (prefersDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      }
    };

    initializeTheme();
  }, [user]);

  // テーマ切り替えハンドラー
  const toggleDarkMode = async () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      setDarkMode(false);
      if (user) {
        await setUserTheme(user.uid, 'light');
      } else {
        localStorage.setItem('theme', 'light');
      }
    } else {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
      if (user) {
        await setUserTheme(user.uid, 'dark');
      } else {
        localStorage.setItem('theme', 'dark');
      }
    }
  };

  return (
    <nav className="bg-indigo-600 text-white shadow-lg dark:bg-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ロゴとタイトル */}
          <Link to="/" className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8" />
            <span className="font-bold text-xl">Club Blog</span>
          </Link>
          
          {/* ナビゲーションメニュー */}
          <div className="flex items-center space-x-4">
            {/* 新規投稿リンク */}
            <Link 
              to="/add-article" 
              className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
            >
              <PenLine className="h-5 w-5" />
              <span>新規投稿</span>
            </Link>
            
            {/* テーマ切替ボタン */}
            <button
              onClick={toggleDarkMode}
              className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span>テーマ切替</span>
            </button>

            {/* ユーザーがログインしている場合のみ表示 */}
            {user ? (
              <>
                {/* アバターをプロフィールページへのリンクに変更 */}
                <Link to={`/users/${user.uid}`} className="flex items-center space-x-3 cursor-pointer">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <User className="h-8 w-8" />
                  )}
                  <span className="font-medium">{user.displayName}</span>
                </Link>
                
                {/* ログアウトボタン */}
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
                >
                  <LogOut className="h-5 w-5" />
                  <span>ログアウト</span>
                </button>
              </>
            ) : (
              /* ユーザーがログインしていない場合はログインリンクを表示 */
              <Link 
                to="/login" 
                className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700"
              >
                <PenLine className="h-5 w-5" />
                <span>ログイン</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

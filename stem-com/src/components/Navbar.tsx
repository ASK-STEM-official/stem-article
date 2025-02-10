import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, PenLine, BookOpen, LogOut, Sun, Moon, User as UserIcon } from 'lucide-react';
import { getUserTheme, setUserTheme } from '../lib/firebase/firestore.ts';

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const initializeTheme = async () => {
      if (user) {
        const userTheme = await getUserTheme(user.uid);
        if (userTheme === 'dark') {
          setDarkMode(true);
          document.documentElement.classList.add('dark');
        } else {
          setDarkMode(false);
          document.documentElement.classList.remove('dark');
        }
      } else {
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
    user ? await setUserTheme(user.uid, darkMode ? 'light' : 'dark') : localStorage.setItem('theme', darkMode ? 'light' : 'dark');
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <nav className="bg-indigo-600 text-white shadow-lg dark:bg-gray-800 relative">
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
            {user && user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600 shadow-md" />
            ) : (
              <UserIcon className="h-8 w-8 text-gray-400" />
            )}
          </div>
        </div>
      </div>
      
      {/* メニュー（スマートフォンと同じ表示をPCにも適用） */}
      <div className={`fixed top-16 left-0 w-64 bg-indigo-700 dark:bg-gray-900 transition-transform duration-300 ease-in-out transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'} p-4 flex flex-col h-[calc(100vh-4rem)]`}>
        <Link to="/add-article" className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors dark:hover:bg-gray-700">
          <PenLine className="h-5 w-5" />
          <span>新規投稿</span>
        </Link>
        <div className="flex-grow"></div>
        <button onClick={onLogout} className="flex items-center space-x-2 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors">
          <LogOut className="h-5 w-5" />
          <span>ログアウト</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

// src/App.tsx
import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom"; // HashRouter をインポート
import { getAuth, signInWithPopup, GithubAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import ArticleList from "./pages/ArticleList.tsx";
import Profileset from "./pages/Profile-set.tsx";
import ArticleDetail from "./pages/ArticleDetail.tsx";
import AddArticle from "./pages/AddArticle.tsx";
import Navbar from "./components/Navbar.tsx";
import { Github } from 'lucide-react';
import UserProfile from "./pages/UserProfile.tsx";
import EditArticle from "./pages/EditArticle.tsx";

const App = () => {
  const [user, setUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleGitHubLogin = async () => {
    try {
      const auth = getAuth();
      const provider = new GithubAuthProvider();
      provider.addScope("read:org");

      const result = await signInWithPopup(auth, provider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;

      const response = await fetch("https://api.github.com/user/orgs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("GitHub APIへのリクエストが失敗しました");
      }

      const organizations = await response.json();
      const isInOrganization = organizations.some(
        (org) => org.login === "ganon-test"
      );
      if (isInOrganization) {
        setUser(result.user);
      } else {
        setUser(result.user);
        console.log("指定された組織に所属していませんがまぁいいでしょう");
      }

    } catch (error) {
      console.error("GitHubログインエラー:", error);
      setErrorMessage(error.message || "ログインに失敗しました。もう一度試してください。");
    }
  };

  const handleEmailLogin = async () => {
    try {
      const auth = getAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
    } catch (error) {
      console.error("Emailログインエラー:", error);
      setErrorMessage(error.message || "メールログインに失敗しました。");
    }
  };

  const handleEmailSignUp = async () => {
    try {
      const auth = getAuth();
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setUser(result.user);
    } catch (error) {
      console.error("サインアップエラー:", error);
      setErrorMessage(error.message || "サインアップに失敗しました。");
    }
  };

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-lightBackground dark:bg-darkBackground text-gray-900 dark:text-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold">
            部活動ブログへようこそ
          </h2>
          <p className="mt-2 text-center text-sm">
            部員専用の記事投稿・共有プラットフォーム
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <button
              onClick={handleGitHubLogin}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              <Github className="h-5 w-5 mr-2" />
              GitHubでログイン
            </button>

            <div className="mt-6">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                className="w-full px-3 py-2 mb-2 border rounded"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                className="w-full px-3 py-2 mb-2 border rounded"
              />
              <button
                onClick={handleEmailLogin}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded mb-2"
              >
                メールログイン
              </button>
              <button
                onClick={handleEmailSignUp}
                className="w-full bg-green-600 text-white px-4 py-2 rounded"
              >
                サインアップ
              </button>
            </div>

            {errorMessage && (
              <div className="mt-4 text-sm text-red-600 text-center">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-lightBackground dark:bg-darkBackground text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Navbar user={user} onLogout={handleLogout} toggleDarkMode={toggleDarkMode} darkMode={darkMode} />
        <Routes>
          <Route path="/add-article" element={<AddArticle />} />
          <Route path="/articles/:id" element={<ArticleDetail />} />
          <Route path="/users/:id" element={<UserProfile />} />
          <Route path="/profileset" element={<Profileset />} />
          <Route path="/articles/:id/edit" element={<EditArticle />} />
          <Route path="/" element={<ArticleList />} />
          <Route path="*" element={<Navigate to="/" replace />} /> {/* 404 用 */}
        </Routes>
      </div>
    </Router>
  );
};

export default App;

// src/App.tsx
// このクラスはReactアプリのエントリーポイントであり、GitHubログインによる認証と
// 指定した組織チェックを行った後、ログインが許可されている場合のみルーティングを行います。

import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom"; // HashRouter をインポート
import {
  getAuth,
  signInWithPopup,
  GithubAuthProvider,
  signOut,
} from "firebase/auth";
import ArticleList from "./pages/ArticleList.tsx";
import Profileset from "./pages/Profile-set.tsx";
import ArticleDetail from "./pages/ArticleDetail.tsx";
import AddArticle from "./pages/AddArticle.tsx";
import Navbar from "./components/Navbar.tsx";
import { Github } from "lucide-react";
import UserProfile from "./pages/UserProfile.tsx";
import EditArticle from "./pages/EditArticle.tsx";

const App = () => {
  // user にはログインしているユーザー情報を、errorMessage にはエラー時のメッセージを保持する
  const [user, setUser] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ダークモード管理用の state
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // 初回マウント時にOSのダークモード設定を反映させる
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  /**
   * GitHub認証ボタンを押下した際のイベントハンドラ。
   * Firebase Authの signInWithPopup を使ってGitHubログインを行う。
   * ログイン後、取得したトークンを使ってGitHub APIを呼び出し、
   * ユーザーが指定の組織(ganon-test)に所属しているかを確認する。
   */
  const handleGitHubLogin = async () => {
    try {
      const auth = getAuth();
      const provider = new GithubAuthProvider();

      // 組織の情報を取得する場合は "read:org" スコープが必要
      provider.addScope("read:org");

      // ポップアップでGitHubログイン
      const result = await signInWithPopup(auth, provider);

      // 取得したCredentialからアクセストークンを取り出す
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error("アクセストークンを取得できませんでした。");
      }

      // GitHub APIを呼び出してユーザーが所属している組織を取得
      const response = await fetch("https://api.github.com/user/orgs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("GitHub APIへのリクエストが失敗しました。");
      }

      const organizations = await response.json();
      // 指定の組織に入っているかチェック
      const isInOrganization = organizations.some(
        (org: { login: string }) => org.login === "ASK-STEM-official"
      );

      if (isInOrganization) {
        // 組織に所属している場合のみログイン許可
        setUser(result.user);
      } else {
        // 組織に所属していない場合はエラー扱い
        throw new Error("指定された組織に所属していません。ログインを許可できません。");
      }
    } catch (error: any) {
      console.error("GitHubログインエラー:", error);
      setErrorMessage(
        error.message || "ログインに失敗しました。もう一度試してください。"
      );
    }
  };

  /**
   * ログアウトを行う。
   */
  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  /**
   * ダークモードの切り替え。
   */
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  /**
   * ログインしていない場合は、GitHubログインボタンのみ表示する。
   * 組織に所属していない/ログインに失敗した場合は、エラーメッセージを表示する。
   */
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

  /**
   * ログイン後は、メインのルーティングを表示する。
   * ユーザーが認証されていれば通常の機能（記事の閲覧・投稿・編集など）を利用可能。
   */
  return (
    <Router>
      <div className="min-h-screen bg-lightBackground dark:bg-darkBackground text-gray-900 dark:text-gray-100 transition-colors duration-300">
        {/* ナビゲーションバー: ログアウトボタン、テーマ切り替えなど */}
        <Navbar
          user={user}
          onLogout={handleLogout}
          toggleDarkMode={toggleDarkMode}
          darkMode={darkMode}
        />

        {/* ルーティング設定 */}
        <Routes>
          {/* 新規投稿ページ */}
          <Route path="/add-article" element={<AddArticle />} />
          {/* 記事詳細ページ */}
          <Route path="/articles/:id" element={<ArticleDetail />} />
          {/* ユーザープロフィールページ */}
          <Route path="/users/:id" element={<UserProfile />} />
          {/* プロフィール設定ページ */}
          <Route path="/profileset" element={<Profileset />} />
          {/* 記事編集ページ */}
          <Route path="/articles/:id/edit" element={<EditArticle />} />

          {/* トップページ -> 記事一覧 */}
          <Route path="/" element={<ArticleList />} />

          {/* 存在しないページはトップにリダイレクト（404用） */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;

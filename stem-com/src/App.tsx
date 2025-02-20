// App.tsx
import React, { useState, useEffect } from "react";
import {
  HashRouter as Router, // HashRouterを使用する例
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
// Firebase Auth関連
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
// Firestore関連
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";

// ページ・コンポーネント類
import ArticleList from "./pages/ArticleList.tsx";
import Profileset from "./pages/Profile-set.tsx";
import ArticleDetail from "./pages/ArticleDetail.tsx";
import AddArticle from "./pages/AddArticle.tsx";
import Navbar from "./components/Navbar.tsx";
import { Github } from "lucide-react";
import UserProfile from "./pages/UserProfile.tsx";
import EditArticle from "./pages/EditArticle.tsx";
import Rank from "./pages/rank.tsx";
import SeriesArticles from "./pages/SeriesList.tsx";

interface UserData {
  avatarUrl: string;
  displayName: string;
  bio: string;
  uid: string;
}

const App = () => {
  // Firestore から取得したユーザーデータ
  const [user, setUser] = useState<UserData | null>(null);
  // ログインエラー等を表示するためのメッセージ
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Firebase Auth の初期化完了フラグ
  const [initializing, setInitializing] = useState<boolean>(true);

  // onAuthStateChanged でログイン状態を監視
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firestore からユーザーデータを取得
        const userData = await fetchUserData(firebaseUser.uid);
        if (userData) {
          setUser(userData);
        }
      }
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // GitHubログイン処理
  const handleGitHubLogin = async () => {
    try {
      const auth = getAuth();
      // ローカルに認証状態を保持
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GithubAuthProvider();
      // 組織チェック用に read:org スコープを追加
      provider.addScope("read:org");

      // ポップアップでログイン
      const result = await signInWithPopup(auth, provider);

      // アクセストークンを取得
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (!token) {
        throw new Error("アクセストークンを取得できませんでした。");
      }

      // GitHub API でユーザーが所属している組織を取得
      const orgResponse = await fetch("https://api.github.com/user/orgs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!orgResponse.ok) {
        throw new Error("GitHub API へのリクエストが失敗しました。");
      }
      const organizations = await orgResponse.json();

      // 特定の組織に所属しているかどうかを確認
      const isInOrganization = organizations.some(
        (org: { login: string }) => org.login === "ASK-STEM-official"
      );
      if (isInOrganization) {
        // Firestore にユーザー情報を保存
        await saveUserData(result.user, token);
        // 保存後に再取得して state を更新
        const userData = await fetchUserData(result.user.uid);
        setUser(userData);
      } else {
        throw new Error("指定された組織に所属していません。ログインを許可できません。");
      }
    } catch (error: any) {
      console.error("GitHub ログインエラー:", error);
      setErrorMessage(
        error.message || "ログインに失敗しました。もう一度試してください。"
      );
    }
  };

  // Firestore にユーザー情報を保存
  const saveUserData = async (firebaseUser: any, token: string) => {
    try {
      const db = getFirestore();
      const userRef = doc(db, "users", firebaseUser.uid);

      const existingDoc = await getDoc(userRef);

      // GitHub API でユーザー詳細を取得
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!userResponse.ok) {
        throw new Error("GitHub API からユーザー情報の取得に失敗しました。");
      }
      const githubUser = await userResponse.json();
      const githubAvatar = githubUser.avatar_url || "";
      const githubDisplayName = githubUser.name || githubUser.login || "";

      // ドキュメントがなければ新規作成
      if (!existingDoc.exists()) {
        const userData = {
          avatarUrl: githubAvatar,
          displayName: githubDisplayName,
          bio: "",
          uid: firebaseUser.uid,
        };
        await setDoc(userRef, userData);
      }
    } catch (error) {
      console.error("ユーザーデータの保存に失敗しました:", error);
    }
  };

  // Firestore からユーザーデータを取得
  const fetchUserData = async (uid: string): Promise<UserData | null> => {
    try {
      const db = getFirestore();
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return userSnap.data() as UserData;
      } else {
        console.warn("ユーザーデータが存在しません。");
        return null;
      }
    } catch (error) {
      console.error("ユーザーデータの取得に失敗しました:", error);
      return null;
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  // Firebase Auth の初期化が終わるまでローディング表示
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // 未ログイン時の画面
  if (!user) {
    return (
      <div className="min-h-screen bg-lightBackground dark:bg-darkBackground text-gray-900 dark:text-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold">
            STEM研究部記事投稿サイトへようこそ
          </h2>
          <p className="mt-2 text-center text-sm">
            STEM研究部専用の記事投稿・共有プラットフォーム
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

  // ログイン済みの画面
  return (
    <div className="min-h-screen bg-lightBackground dark:bg-darkBackground text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Router>
        {/* ナビゲーションバー（サイドバー含む） */}
        <Navbar user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/add-article" element={<AddArticle />} />
            <Route path="/articles/:id" element={<ArticleDetail />} />
            <Route path="/articles/:id/edit" element={<EditArticle />} />
            <Route path="/users/:id" element={<UserProfile />} />
            <Route path="/profileset" element={<Profileset user={user} />} />
            <Route path="/rank" element={<Rank />} />
            <Route path="/series/:id" element={<SeriesArticles />} />
            <Route path="/" element={<ArticleList />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Navbar>
      </Router>
    </div>
  );
};

export default App;

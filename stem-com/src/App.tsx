import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom"; // HashRouter をインポート
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"; // Firebase Authentication 用の関数をインポート
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore"; // Firestore 用
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
  // Firestore から取得したユーザーデータを保持する state
  const [user, setUser] = useState<UserData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ダークモード管理用の state
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // 認証状態の初期化中フラグ（firebase の自動ログイン確認中に利用）
  const [initializing, setInitializing] = useState<boolean>(true);

  // 初回マウント時に OS のダークモード設定を反映させる
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
   * firebase の認証キャッシュを利用した自動ログイン処理
   * onAuthStateChanged で認証状態の変化を監視し、ログイン済みの場合は Firestore からユーザーデータを取得します。
   */
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 既にログイン済みの場合、Firestore からユーザーデータを取得して状態を更新
        const userData = await fetchUserData(firebaseUser.uid);
        if (userData) {
          setUser(userData);
        }
      }
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  /**
   * GitHub 認証ボタンを押下した際のイベントハンドラ。
   * Firebase Auth の signInWithPopup を使って GitHub ログインを行い、
   * ログイン後に取得したトークンで組織所属を確認します。
   * 所属が確認できたら、Firestore にユーザーデータを保存・取得します。
   */
  const handleGitHubLogin = async () => {
    try {
      const auth = getAuth();
      // firebase の認証キャッシュ（local persistence）を明示的に設定
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GithubAuthProvider();
      // 組織の情報を取得するために "read:org" スコープを追加
      provider.addScope("read:org");

      // ポップアップで GitHub ログイン
      const result = await signInWithPopup(auth, provider);

      // 取得した Credential からアクセストークンを取り出す
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error("アクセストークンを取得できませんでした。");
      }

      // GitHub API を呼び出してユーザーが所属している組織を取得
      const orgResponse = await fetch("https://api.github.com/user/orgs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!orgResponse.ok) {
        throw new Error("GitHub API へのリクエストが失敗しました。");
      }

      const organizations = await orgResponse.json();
      // 指定の組織に入っているかチェック (ここでは ASK-STEM-official を想定)
      const isInOrganization = organizations.some(
        (org: { login: string }) => org.login === "ASK-STEM-official"
      );

      if (isInOrganization) {
        // 組織に所属している場合のみログイン許可
        // Firestore にユーザー情報を保存（初回のみ）
        await saveUserData(result.user, token);

        // Firestore からユーザーデータを取得して状態を更新
        const userData = await fetchUserData(result.user.uid);
        setUser(userData);
      } else {
        // 組織に所属していない場合はエラー扱い
        throw new Error("指定された組織に所属していません。ログインを許可できません。");
      }
    } catch (error: any) {
      console.error("GitHub ログインエラー:", error);
      setErrorMessage(
        error.message || "ログインに失敗しました。もう一度試してください。"
      );
    }
  };

  const saveUserData = async (firebaseUser: any, token: string) => {
    try {
      const db = getFirestore();
      // Firebase Auth のユーザーIDをドキュメントIDにする
      const userRef = doc(db, "users", firebaseUser.uid);

      // すでにユーザードキュメントがあるかどうかをチェック
      const existingDoc = await getDoc(userRef);

      // GitHub API を使用してユーザーの詳細情報を取得
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

      if (!existingDoc.exists()) {
        // ドキュメントが存在しない場合は新規作成する
        const userData = {
          avatarUrl: githubAvatar,
          displayName: githubDisplayName,
          bio: "", // 初回は空文字
          uid: firebaseUser.uid,
        };
        await setDoc(userRef, userData);
      }
      // 既存ドキュメントがある場合は何もしない（既存のデータを保持）
    } catch (error) {
      console.error("ユーザーデータの保存に失敗しました:", error);
    }
  };

  /**
   * Firestore からユーザーデータを取得する関数。
   */
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

  /**
   * ログアウトを行う関数。
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
   * ダークモードの切り替え関数。
   */
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // 認証状態の初期化中はローディング表示を行う
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  /**
   * ログインしていない場合は、GitHub ログインボタンのみ表示する。
   * 組織に所属していない/ログインに失敗した場合は、エラーメッセージを表示する。
   */
  if (!user) {
    return (
      <div className="min-h-screen bg-lightBackground dark:bg-darkBackground text-gray-900 dark:text-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
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

  /**
   * ログイン後は、メインのルーティングを表示する。
   * ユーザーが認証されていれば通常の機能（記事の閲覧・投稿・編集など）を利用可能。
   */
  return (
    <Router>
      {/* 固定ナビバー分の高さを確保するため、全体コンテンツにpt-16を追加 */}
      <div className="pt-16 min-h-screen bg-lightBackground dark:bg-darkBackground text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <Navbar user={user} onLogout={handleLogout} />
        <Routes>
          {/* 新規投稿ページ */}
          <Route path="/add-article" element={<AddArticle />} />
          {/* 記事詳細ページ */}
          <Route path="/articles/:id" element={<ArticleDetail />} />
          {/* 記事編集ページ */}
          <Route path="/articles/:id/edit" element={<EditArticle />} />
          {/* ユーザープロフィールページ */}
          <Route path="/users/:id" element={<UserProfile />} />
          {/* プロフィール設定ページ */}
          <Route path="/profileset" element={<Profileset user={user} />} />
          {/* ランキングページ */}
          <Route path="/rank" element={<Rank />} />
          {/* シリーズ詳細ページ：クリックされたシリーズのIDをもとにシリーズ内の記事一覧を表示 */}
          <Route path="/series/:id" element={<SeriesArticles />} />
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
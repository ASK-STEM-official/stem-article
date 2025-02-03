// src/pages/AddArticle.tsx
import React, { useState, useEffect, FormEvent } from "react";
/* 
   この記事を投稿するコンポーネント。
   Firebase Firestore にタイトルや本文、編集者などを保存し、
   Base64形式の画像をGitHubにアップロードしてURL化する。
   なお、Markdownエディタは自作し、編集タブとプレビュータブを実装しています。
   ※画像のアップロード処理などの仕組みは変更していません。
*/
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid"; // ユニークID生成用
import { useNavigate } from "react-router-dom";

// Firebase Authentication 関連のインポート
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

// Markdown を HTML に変換するための marked ライブラリをインポート
import { marked } from "marked";

// カスタムCSS（必要に応じてエディタ用のスタイルも追加してください）
import "../AddArticle.css";

// ユーザーの型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

const AddArticle: React.FC = () => {
  // タイトルの状態管理
  const [title, setTitle] = useState<string>("");
  // ユーザーIDとアバターURLの状態管理
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  // 自作のMarkdownエディタの入力内容の状態管理
  const [markdownContent, setMarkdownContent] = useState<string>("ここにMarkdownを入力");
  // 編集タブとプレビュータブの切り替え状態 ("edit" または "preview")
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // 画面遷移用の navigate フック
  const navigate = useNavigate();
  const auth = getAuth();

  // ダークモードの状態管理
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // 全ユーザーリスト、選択された編集者、編集者検索用の状態管理
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");

  // ======== 追加: Discordに紹介するかどうかのチェックボックス状態 ========
  // チェックを入れると firestore の "discord" フィールドが false で投稿されます。
  const [introduceDiscord, setIntroduceDiscord] = useState<boolean>(false);

  // --------------------------------------------
  // ダークモードの変更を監視する useEffect
  // --------------------------------------------
  useEffect(() => {
    // 初期のダークモード状態をチェック
    const checkDarkMode = () => {
      const dark = document.documentElement.classList.contains("dark");
      setIsDarkMode(dark);
    };

    checkDarkMode();

    // MutationObserver を利用してダークモードの変更を監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          checkDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // コンポーネントのアンマウント時に observer を解除
    return () => {
      observer.disconnect();
    };
  }, []);

  // --------------------------------------------
  // FirebaseAuth のユーザーログイン状態を監視する useEffect
  // --------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // ログインしている場合、UID とアバターURL を設定
        setUserId(user.uid);
        setUserAvatar(user.photoURL || null);
      } else {
        // ログアウト時は状態をクリア
        setUserId(null);
        setUserAvatar(null);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // --------------------------------------------
  // Firestore の users コレクションから全ユーザーを取得する useEffect
  // --------------------------------------------
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersCol = collection(db, "users");
        const userSnapshot = await getDocs(usersCol);
        const usersList: UserData[] = userSnapshot.docs.map((doc) => ({
          uid: doc.id,
          displayName: doc.data().displayName,
          avatarUrl: doc.data().avatarUrl,
        }));
        setAllUsers(usersList);
      } catch (error) {
        console.error("ユーザーの取得に失敗しました:", error);
      }
    };

    fetchUsers();
  }, []);

  // --------------------------------------------
  // 編集者を追加する関数
  // --------------------------------------------
  const handleAddEditor = (user: UserData) => {
    // すでに選択されている場合は追加しない
    if (selectedEditors.find((editor) => editor.uid === user.uid)) {
      return;
    }
    setSelectedEditors([...selectedEditors, user]);
    setEditorSearch("");
  };

  // --------------------------------------------
  // 選択された編集者を削除する関数
  // --------------------------------------------
  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

  // --------------------------------------------
  // フォーム送信処理
  // --------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      // 自作エディタから Markdown コンテンツを取得
      let content = markdownContent;

      // Markdown 内の Base64 画像を GitHub にアップロードして URL を置換
      content = await processMarkdownContent(content);

      // Firestore に記事を保存
      const articleId = nanoid(10); // ユニークな記事ID生成
      const articleRef = doc(db, "articles", articleId);

      // チェックボックスの状態により discord フィールドの値を設定
      const discordValue = introduceDiscord ? false : true;

      await setDoc(articleRef, {
        title,
        content,
        created_at: serverTimestamp(),
        authorId: userId, // 正しいユーザーIDを設定
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((editor) => editor.uid),
        // ======== 追加: discord フィールド（Boolean） ========
        discord: discordValue,
      });

      alert("記事を追加しました！");
      setTitle("");
      setMarkdownContent(""); // エディタの内容をリセット
      setSelectedEditors([]);
      setIntroduceDiscord(false); // チェックボックスのリセット
      navigate("/"); // 投稿後にリダイレクト
    } catch (error) {
      console.error("エラー:", error);
      alert("記事の投稿に失敗しました。");
    }
  };

  // --------------------------------------------
  // Markdown 内の Base64 画像を GitHub にアップロードして URL を置換する関数
  // --------------------------------------------
  /**
   * Markdownコンテンツ内のBase64画像を検出し、GitHubにアップロードしてURLを置換する関数
   *
   * @param markdown - 元のMarkdownコンテンツ
   * @returns 画像URLが置換されたMarkdownコンテンツ
   */
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    // Base64形式の画像を検出する正規表現
    const base64ImageRegex =
      /!\[([^\]]*)\]\((data:image\/[a-zA-Z]+;base64,([^)]+))\)/g;

    // 画像アップロードのプロミスを格納する配列
    const uploadPromises: Promise<void>[] = [];

    // マッチしたBase64画像とGitHubのURLの対応を保存するオブジェクト
    const base64ToGitHubURLMap: { [key: string]: string } = {};

    let match;
    while ((match = base64ImageRegex.exec(markdown)) !== null) {
      const [
        fullMatch,
        /* altText */,
        dataUrl,
        base64Data,
      ] = match;

      // 同じ画像を複数回アップロードしないようにする
      if (base64ToGitHubURLMap[dataUrl]) {
        continue;
      }

      // 画像をアップロードするプロミスを作成
      const uploadPromise = (async () => {
        try {
          const imageUrl = await uploadBase64ImageToGitHub(
            base64Data,
            fullMatch
          );
          base64ToGitHubURLMap[dataUrl] = imageUrl;
        } catch (error) {
          console.error("画像のアップロードに失敗しました:", error);
          alert("画像のアップロードに失敗しました。");
          // 投稿を中断する場合はエラーをスロー
          throw error;
        }
      })();

      uploadPromises.push(uploadPromise);
    }

    // すべての画像アップロードが完了するまで待機
    await Promise.all(uploadPromises);

    // Markdownコンテンツ内のBase64画像URLをGitHubのURLに置換
    const updatedMarkdown = markdown.replace(
      base64ImageRegex,
      (match, alt, dataUrl) => {
        const githubUrl = base64ToGitHubURLMap[dataUrl];
        if (githubUrl) {
          return `![${alt}](${githubUrl})`;
        }
        // アップロードに失敗した場合は元のBase64画像を保持
        return match;
      }
    );

    return updatedMarkdown;
  };

  // --------------------------------------------
  // Firestore から GitHubトークン を取得する関数
  // --------------------------------------------
  async function fetchGithubToken() {
    try {
      const docRef = doc(db, "keys", "AjZSjYVj4CZSk1O7s8zG"); // 正しいドキュメントIDを指定
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.key; // "key" フィールドの値を返す
      } else {
        console.error("Document not found!");
        return null;
      }
    } catch (error) {
      console.error("Error fetching token:", error);
      return null;
    }
  }

  // --------------------------------------------
  // GitHub に Base64画像をアップロードする関数
  // --------------------------------------------
  /**
   * Base64形式の画像データをGitHubにアップロードし、画像のURLを返す関数
   *
   * @param base64Data - Base64形式の画像データ
   * @param originalMatch - 元のMarkdown画像マッチ
   * @returns GitHubにアップロードされた画像のURL
   */
  const uploadBase64ImageToGitHub = async (
    base64Data: string,
    originalMatch: string
  ): Promise<string> => {
    const GITHUB_API_URL = `https://api.github.com/repos/ASK-STEM-official/Image-Storage/contents/static/images/`;
    const GITHUB_TOKEN = await fetchGithubToken();

    // 画像の種類を判別する
    const imageTypeMatch = originalMatch.match(/data:image\/([a-zA-Z]+);base64,/);
    let imageType = "png"; // デフォルトはPNG
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }

    // ユニークなファイル名を生成
    const id = nanoid(10); // 10文字のユニークID
    const fileName = `${id}.${imageType}`;
    const fileApiUrl = `${GITHUB_API_URL}${fileName}`;

    // ファイルアップロード用のリクエストペイロードを作成
    const payload = {
      message: `Add image: ${fileName}`,
      content: base64Data,
    };

    // GitHub に画像をアップロードするリクエストを送信
    const response = await fetch(fileApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    // GitHub 上の画像URLを構築して返す
    const imageUrl = `https://github.com/ASK-STEM-official/Image-Storage/raw/main/static/images/${fileName}`;
    return imageUrl;
  };

  // --------------------------------------------
  // コンポーネントの描画
  // --------------------------------------------
  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        記事を追加
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* タイトル入力 */}
        <div className="form-group">
          <label htmlFor="title" className="block text-gray-700 dark:text-gray-300">
            タイトル
          </label>
          <input
            type="text"
            id="title"
            placeholder="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Discordに紹介するかどうかのチェックボックス */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            Discordに紹介する
            {/* チェックを入れると firestore の "discord" フィールドが false で投稿される */}
            <input
              type="checkbox"
              className="ml-2"
              checked={introduceDiscord}
              onChange={(e) => setIntroduceDiscord(e.target.checked)}
            />
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            チェックを入れると firestore の「discord」フィールドが false で投稿されます。
          </p>
        </div>

        {/* 編集者追加 */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            編集者を追加
          </label>
          <input
            type="text"
            placeholder="編集者を検索"
            value={editorSearch}
            onChange={(e) => setEditorSearch(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {/* 編集者候補リスト */}
          {editorSearch && (
            <ul className="border border-gray-300 dark:border-gray-600 mt-2 max-h-40 overflow-y-auto">
              {allUsers
                .filter(
                  (user) =>
                    user.displayName.toLowerCase().includes(editorSearch.toLowerCase()) &&
                    user.uid !== userId && // 自分自身は除外
                    !selectedEditors.find((editor) => editor.uid === user.uid) // 既に選択済みの編集者は除外
                )
                .map((user) => (
                  <li
                    key={user.uid}
                    className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={() => handleAddEditor(user)}
                  >
                    <div className="flex items-center">
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className="w-6 h-6 rounded-full mr-2"
                      />
                      <span className="text-gray-800 dark:text-gray-100">
                        {user.displayName}
                      </span>
                    </div>
                  </li>
                ))}
              {allUsers.filter(
                (user) =>
                  user.displayName.toLowerCase().includes(editorSearch.toLowerCase()) &&
                  user.uid !== userId &&
                  !selectedEditors.find((editor) => editor.uid === user.uid)
              ).length === 0 && (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400">
                  該当するユーザーが見つかりません。
                </li>
              )}
            </ul>
          )}
        </div>

        {/* 選択された編集者の表示 */}
        {selectedEditors.length > 0 && (
          <div className="form-group">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">
              現在の編集者
            </label>
            <ul className="space-y-2">
              {selectedEditors.map((editor) => (
                <li
                  key={editor.uid}
                  className="flex items-center justify-between px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                >
                  <div className="flex items-center">
                    <img
                      src={editor.avatarUrl}
                      alt={editor.displayName}
                      className="w-6 h-6 rounded-full mr-2"
                    />
                    <span className="text-gray-800 dark:text-gray-100">
                      {editor.displayName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEditor(editor.uid)}
                    className="text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 自作の Markdown エディタ */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            内容 (Markdown)
          </label>
          {/* 編集・プレビュー切替用のタブボタン */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`px-4 py-2 mr-2 border rounded ${
                activeTab === "edit" ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-700 text-gray-800"
              }`}
            >
              編集
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-2 border rounded ${
                activeTab === "preview" ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-700 text-gray-800"
              }`}
            >
              プレビュー
            </button>
          </div>
          {/* 編集タブ：Markdown入力用テキストエリア */}
          {activeTab === "edit" && (
            <textarea
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              className="w-full h-64 p-2 border rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ここにMarkdownを入力"
            />
          )}
          {/* プレビュ―タブ：入力されたMarkdownを HTML に変換して表示 */}
          {activeTab === "preview" && (
            <div
              className="w-full h-64 p-2 border rounded bg-white dark:bg-gray-700 dark:text-white overflow-auto"
              // marked ライブラリで Markdown を HTML に変換して表示
              dangerouslySetInnerHTML={{ __html: marked(markdownContent) }}
            />
          )}
        </div>

        {/* 投稿ボタン */}
        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          投稿
        </button>
      </form>
    </div>
  );
};

export default AddArticle;

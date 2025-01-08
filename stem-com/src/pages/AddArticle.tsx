// src/pages/AddArticle.tsx
import React, { useState, useRef, useEffect, FormEvent } from "react";
import { doc, setDoc, serverTimestamp, collection, getDocs, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid"; // 短いユニークID生成用
import { Editor } from "@toast-ui/react-editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import { useNavigate } from "react-router-dom";

import colorSyntax from "@toast-ui/editor-plugin-color-syntax";
import "@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css"; // 必要に応じてCSSをインポート

// Import Firebase Authentication
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

// Import custom CSS for editor styling
import "../AddArticle.css";

// ユーザーの型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

const AddArticle: React.FC = () => {
  const [title, setTitle] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null); // ユーザーIDを保持するステート
  const [userAvatar, setUserAvatar] = useState<string | null>(null); // ユーザーのアバターURLを保持するステート
  const editorRef = useRef<Editor>(null);
  const navigate = useNavigate();
  const auth = getAuth();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false); // ダークモードの状態を管理

  const [allUsers, setAllUsers] = useState<UserData[]>([]); // 全ユーザーのリスト
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]); // 選択された編集者

  const [editorSearch, setEditorSearch] = useState<string>(""); // 編集者検索用のステート

  useEffect(() => {
    // 初期のダークモード状態を設定
    const checkDarkMode = () => {
      const dark = document.documentElement.classList.contains("dark");
      setIsDarkMode(dark);
    };

    checkDarkMode();

    // ダークモードの変更を監視するためのMutationObserverを設定
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          checkDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // クリーンアップ関数
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    // 認証状態の監視
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // ユーザーがログインしている場合、UIDとアバターURLを取得
        setUserId(user.uid);
        setUserAvatar(user.photoURL || null);
      } else {
        // ユーザーがログアウトしている場合、適切な処理を行う
        setUserId(null);
        setUserAvatar(null);
      }
    });

    // クリーンアップ関数
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    // 全ユーザーをFirestoreから取得
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

  const handleAddEditor = (user: UserData) => {
    // 既に選択されている場合は追加しない
    if (selectedEditors.find((editor) => editor.uid === user.uid)) {
      return;
    }
    setSelectedEditors([...selectedEditors, user]);
    setEditorSearch("");
  };

  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const editorInstance = editorRef.current?.getInstance();
      let markdownContent = editorInstance?.getMarkdown() || "";

      // 投稿時に画像を処理
      markdownContent = await processMarkdownContent(markdownContent);

      // Firestoreに保存
      const articleId = nanoid(10); // ユニークな記事IDを生成
      const articleRef = doc(db, "articles", articleId);
      await setDoc(articleRef, {
        title,
        content: markdownContent,
        created_at: serverTimestamp(),
        authorId: userId, // 正しいユーザーIDを設定
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((editor) => editor.uid), // 編集者のUIDを保存
      });

      alert("記事を追加しました！");
      setTitle("");
      editorInstance?.setMarkdown("");
      setSelectedEditors([]); // 編集者の選択をリセット
      navigate("/"); // 投稿後にリダイレクト
    } catch (error) {
      console.error("エラー:", error);
      alert("記事の投稿に失敗しました。");
    }
  };

  /**
   * Markdownコンテンツ内のBase64画像を検出し、GitHubにアップロードしてURLを置換する
   *
   * @param {string} markdown - 元のMarkdownコンテンツ
   * @returns {string} - 画像URLが置換されたMarkdownコンテンツ
   */
  const processMarkdownContent = async (
    markdown: string
  ): Promise<string> => {
    // Base64形式の画像を検出する正規表現
    const base64ImageRegex =
      /!\[([^\]]*)\]\((data:image\/[a-zA-Z]+;base64,([^)]+))\)/g;

    // 画像アップロードのプロミスを格納する配列
    const uploadPromises: Promise<void>[] = [];

    // マッチを一時的に保存するオブジェクト
    const base64ToGitHubURLMap: { [key: string]: string } = {};

    let match;
    while ((match = base64ImageRegex.exec(markdown)) !== null) {
      const [fullMatch, /* altText */, dataUrl, base64Data] = match;

      // 同じ画像を複数回アップロードしないようにする
      if (base64ToGitHubURLMap[dataUrl]) {
        continue;
      }

      // Capture variables to avoid referencing 'match' directly
      const currentFullMatch = fullMatch;
      const currentBase64Data = base64Data;

      // 画像をアップロードするプロミスを作成
      const uploadPromise = (async () => {
        try {
          const imageUrl = await uploadBase64ImageToGitHub(
            currentBase64Data,
            currentFullMatch
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
      (match, alt, dataUrl, base64Data) => {
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

  /**
   * Base64形式の画像データをGitHubにアップロードし、URLを返す
   *
   * @param {string} base64Data - Base64形式の画像データ
   * @param {string} originalMatch - 元のMarkdown画像マッチ
   * @returns {string} - GitHubにアップロードされた画像のURL
   */
  const uploadBase64ImageToGitHub = async (
    base64Data: string,
    originalMatch: string
  ): Promise<string> => {
    const GITHUB_API_URL = `https://api.github.com/repos/ganondorofu/Img_save/contents/static/images/`;
    const GITHUB_TOKEN = await fetchGithubToken();

    // 画像の種類を判別
    const imageTypeMatch = originalMatch.match(
      /data:image\/([a-zA-Z]+);base64,/
    );
    let imageType = "png"; // デフォルトはPNG
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }

    // 短いユニークIDを生成してファイル名を作成
    const id = nanoid(10); // 10文字のユニークID
    const fileName = `${id}.${imageType}`;

    // ファイルアップロード用のAPI URLを構築
    const fileApiUrl = `${GITHUB_API_URL}${fileName}`;

    // リクエストペイロードを準備
    const payload = {
      message: `Add image: ${fileName}`,
      content: base64Data,
    };

    // GitHubに画像をアップロードするリクエストを送信
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

    // GitHub上の画像URLを構築
    const imageUrl = `https://github.com/ganondorofu/Img_save/raw/main/static/images/${fileName}`;
    return imageUrl;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        記事を追加
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* タイトル入力 */}
        <div className="form-group">
          <label
            htmlFor="title"
            className="block text-gray-700 dark:text-gray-300"
          >
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
          {/* 編集者の候補リスト */}
          {editorSearch && (
            <ul className="border border-gray-300 dark:border-gray-600 mt-2 max-h-40 overflow-y-auto">
              {allUsers
                .filter(
                  (user) =>
                    user.displayName
                      .toLowerCase()
                      .includes(editorSearch.toLowerCase()) &&
                    user.uid !== userId && // 自分自身を除外
                    !selectedEditors.find((editor) => editor.uid === user.uid) // 既に選択されている編集者を除外
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
                  user.displayName
                    .toLowerCase()
                    .includes(editorSearch.toLowerCase()) &&
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

        {/* コンテンツ入力 */}
        <div className="form-group">
          <label
            htmlFor="content"
            className="block text-gray-700 dark:text-gray-300"
          >
            内容 (Markdown)
          </label>
          <Editor
            ref={editorRef}
            initialValue="ここにMarkdownを入力"
            previewStyle="vertical"
            height="400px"
            initialEditType="wysiwyg" // WYSIWYGモードに設定
            useCommandShortcut
            plugins={[colorSyntax]}
            theme={isDarkMode ? "dark" : "light"} // ダークモードに応じてテーマを設定
          />
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

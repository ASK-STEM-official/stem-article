// src/pages/AddArticle.tsx
import React, { useState, useEffect, FormEvent } from "react";
// Firebase関連のインポート
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid"; // ユニークID生成用ライブラリ
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
// Markdownプレビュー用ライブラリ（npm install react-markdown で導入してください）
import ReactMarkdown from "react-markdown";
// カスタムCSSのインポート
import "../AddArticle.css";

// ユーザーの型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * 記事投稿用コンポーネント
 * ・タイトル、内容、編集者、Discord紹介チェックボックスを扱う
 * ・GUIのマークダウンエディタ（左：入力、右：プレビュー）を採用
 * ・画像追加ボタンでモーダルウィンドウを表示し、画像ファイルをBase64に変換してマークダウン形式で挿入
 * ・投稿時は、マークダウン内のBase64画像をGitHubにアップロードしてURLに置換する
 */
const AddArticle: React.FC = () => {
  // ----------------------------
  // 各種状態管理
  // ----------------------------
  // タイトル
  const [title, setTitle] = useState<string>("");
  // マークダウンコンテンツ（エディタの入力値）
  const [markdownContent, setMarkdownContent] = useState<string>("");
  // ユーザー情報（UID・アバターURL）
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  // ダークモード状態
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  // 全ユーザーリスト（編集者候補用）
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  // 選択された編集者リスト
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  // 編集者検索用テキスト
  const [editorSearch, setEditorSearch] = useState<string>("");
  // Discord紹介チェックボックス状態
  // チェック＝true の場合、Firestoreの「discord」フィールドは false になるロジック
  const [introduceDiscord, setIntroduceDiscord] = useState<boolean>(false);
  // ----------------------------
  // 画像アップロード用モーダル状態
  // ----------------------------
  // 画像追加モーダル表示の制御
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  // モーダル内で選択された画像ファイル
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // 画面遷移用
  const navigate = useNavigate();
  // Firebase認証インスタンスの取得
  const auth = getAuth();

  // ----------------------------
  // ダークモードの変更を監視する useEffect
  // ----------------------------
  useEffect(() => {
    // 現在のダークモード状態をチェックして設定
    const checkDarkMode = () => {
      const dark = document.documentElement.classList.contains("dark");
      setIsDarkMode(dark);
    };

    checkDarkMode();

    // MutationObserverでHTMLルートのclass属性変化を監視
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

    return () => {
      observer.disconnect();
    };
  }, []);

  // ----------------------------
  // FirebaseAuthのユーザーログイン状態を監視する useEffect
  // ----------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        // ログインしている場合、UIDとアバターURLを状態に保存
        setUserId(user.uid);
        setUserAvatar(user.photoURL || null);
      } else {
        // ログアウトの場合、状態をリセット
        setUserId(null);
        setUserAvatar(null);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // ----------------------------
  // Firestoreの users コレクションから全ユーザーを取得する useEffect
  // ----------------------------
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

  // ----------------------------
  // 編集者の追加処理
  // ----------------------------
  const handleAddEditor = (user: UserData) => {
    // すでに選択されている場合は追加しない
    if (selectedEditors.find((editor) => editor.uid === user.uid)) {
      return;
    }
    setSelectedEditors([...selectedEditors, user]);
    setEditorSearch("");
  };

  // ----------------------------
  // 編集者の削除処理
  // ----------------------------
  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

  // ----------------------------
  // 画像アップロードモーダル内でのアップロード処理
  // ----------------------------
  const handleUploadImage = () => {
    if (!selectedImageFile) {
      alert("画像ファイルを選択してください。");
      return;
    }

    const reader = new FileReader();
    // 画像ファイルをBase64形式に変換
    reader.readAsDataURL(selectedImageFile);
    reader.onload = () => {
      const result = reader.result as string;
      // マークダウン形式の画像挿入文を作成（altテキストは「画像」としている）
      const imageMarkdown = `\n![画像](${result})\n`;
      // 現在のマークダウンコンテンツに追記
      setMarkdownContent((prev) => prev + imageMarkdown);
      // モーダル状態と選択ファイルをリセット
      setShowImageModal(false);
      setSelectedImageFile(null);
    };
    reader.onerror = () => {
      alert("画像の読み込みに失敗しました。");
    };
  };

  // ----------------------------
  // フォーム送信時の処理
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      let content = markdownContent;
      // 投稿時、Markdown内のBase64画像をGitHubにアップロードしてURLに置換する
      content = await processMarkdownContent(content);

      // Firestoreに保存するためのユニークな記事IDを生成
      const articleId = nanoid(10);
      const articleRef = doc(db, "articles", articleId);

      // Discord紹介チェックボックスのロジック（チェック=trueの場合、discordフィールドはfalse）
      const discordValue = introduceDiscord ? false : true;

      // Firestoreに記事データを保存
      await setDoc(articleRef, {
        title,
        content,
        created_at: serverTimestamp(),
        authorId: userId, // ログインユーザーのUID
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((editor) => editor.uid),
        // 追加: discord フィールド（Boolean）
        discord: discordValue,
      });

      alert("記事を追加しました！");
      // 状態のリセット
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      setIntroduceDiscord(false);
      navigate("/"); // 投稿後にトップページへリダイレクト
    } catch (error) {
      console.error("エラー:", error);
      alert("記事の投稿に失敗しました。");
    }
  };

  // ----------------------------
  // Markdown内のBase64画像をGitHubにアップロードしてURLに置換する処理
  // ----------------------------
  /**
   * Markdownコンテンツ内のBase64画像を検出し、GitHubにアップロード後にURLを置換する
   *
   * @param markdown - 元のMarkdownコンテンツ
   * @returns {Promise<string>} - 画像URLが置換されたMarkdownコンテンツ
   */
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    // Base64画像を検出する正規表現
    const base64ImageRegex =
      /!\[([^\]]*)\]\((data:image\/[a-zA-Z]+;base64,([^)]+))\)/g;
    // 画像アップロード処理のプロミスを保持する配列
    const uploadPromises: Promise<void>[] = [];
    // Base64画像URLとGitHubアップロード後のURLのマッピング
    const base64ToGitHubURLMap: { [key: string]: string } = {};

    let match;
    while ((match = base64ImageRegex.exec(markdown)) !== null) {
      const [
        fullMatch,
        /* altText */,
        dataUrl,
        base64Data,
      ] = match;

      // 同じ画像を複数回アップロードしないためのチェック
      if (base64ToGitHubURLMap[dataUrl]) {
        continue;
      }

      // 画像アップロードのプロミスを作成
      const uploadPromise = (async () => {
        try {
          const imageUrl = await uploadBase64ImageToGitHub(base64Data, fullMatch);
          base64ToGitHubURLMap[dataUrl] = imageUrl;
        } catch (error) {
          console.error("画像のアップロードに失敗しました:", error);
          alert("画像のアップロードに失敗しました。");
          // エラー発生時は投稿処理を中断
          throw error;
        }
      })();
      uploadPromises.push(uploadPromise);
    }

    // すべての画像アップロード処理が完了するまで待機
    await Promise.all(uploadPromises);

    // Markdown内のBase64画像をGitHubのURLに置換する
    const updatedMarkdown = markdown.replace(
      base64ImageRegex,
      (match, alt, dataUrl) => {
        const githubUrl = base64ToGitHubURLMap[dataUrl];
        if (githubUrl) {
          return `![${alt}](${githubUrl})`;
        }
        return match; // アップロード失敗時は元の記法を保持
      }
    );

    return updatedMarkdown;
  };

  // ----------------------------
  // FirestoreからGitHubトークンを取得する処理
  // ----------------------------
  async function fetchGithubToken() {
    try {
      // Firestore内のキー情報のドキュメントIDを指定（適宜変更してください）
      const docRef = doc(db, "keys", "AjZSjYVj4CZSk1O7s8zG");
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

  // ----------------------------
  // GitHubにBase64画像をアップロードする処理
  // ----------------------------
  /**
   * Base64形式の画像データをGitHubにアップロードし、画像URLを返す
   *
   * @param base64Data - Base64形式の画像データ
   * @param originalMatch - 元のMarkdown画像記法
   * @returns {Promise<string>} - GitHubにアップロードされた画像のURL
   */
  const uploadBase64ImageToGitHub = async (
    base64Data: string,
    originalMatch: string
  ): Promise<string> => {
    // GitHub APIのエンドポイント（適宜リポジトリやパスを変更してください）
    const GITHUB_API_URL = `https://api.github.com/repos/ASK-STEM-official/Image-Storage/contents/static/images/`;
    const GITHUB_TOKEN = await fetchGithubToken();

    // 画像の種類を判定（例：png, jpegなど）
    const imageTypeMatch = originalMatch.match(/data:image\/([a-zA-Z]+);base64,/);
    let imageType = "png"; // デフォルトはpng
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }

    // 短いユニークIDを生成してファイル名を作成
    const id = nanoid(10);
    const fileName = `${id}.${imageType}`;
    const fileApiUrl = `${GITHUB_API_URL}${fileName}`;

    // GitHubにアップロードするためのリクエストペイロード
    const payload = {
      message: `Add image: ${fileName}`,
      content: base64Data,
    };

    // GitHub APIにPUTリクエストを送信して画像をアップロード
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

    // GitHub上の画像URLを構築して返す
    const imageUrl = `https://github.com/ASK-STEM-official/Image-Storage/raw/main/static/images/${fileName}`;
    return imageUrl;
  };

  // ----------------------------
  // コンポーネントの描画
  // ----------------------------
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

        {/* Discord紹介チェックボックス */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            Discordに紹介する
            {/* チェックするとdiscordフィールドがfalseになる */}
            <input
              type="checkbox"
              className="ml-2"
              checked={introduceDiscord}
              onChange={(e) => setIntroduceDiscord(e.target.checked)}
            />
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            チェックを入れると Firestore の「discord」フィールドが false で投稿されます。
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
                    user.displayName
                      .toLowerCase()
                      .includes(editorSearch.toLowerCase()) &&
                    user.uid !== userId &&
                    !selectedEditors.find((editor) => editor.uid === user.uid)
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

        {/* マークダウンエディタ（GUI版） */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            内容 (Markdown)
          </label>
          <div className="flex flex-col md:flex-row gap-4">
            {/* 左側：マークダウン入力エリアと画像追加ボタン */}
            <div className="w-full md:w-1/2">
              <textarea
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="ここにMarkdownを入力"
                className="w-full h-80 p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                画像追加
              </button>
            </div>
            {/* 右側：マークダウンプレビュー */}
            <div className="w-full md:w-1/2 h-80 overflow-y-auto p-2 border rounded bg-white dark:bg-gray-700 dark:text-white">
              <ReactMarkdown>{markdownContent}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* 投稿ボタン */}
        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          投稿
        </button>
      </form>

      {/* ----------------------------
          画像アップロード用モーダル
          ---------------------------- */}
      {showImageModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-80">
            <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">
              画像をアップロード
            </h2>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setSelectedImageFile(e.target.files[0]);
                }
              }}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImageFile(null);
                }}
                className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleUploadImage}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                アップロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddArticle;

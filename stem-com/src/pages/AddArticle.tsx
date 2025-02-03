// src/pages/AddArticle.tsx
import React, { useState, useEffect, useRef, FormEvent } from "react";
/* 
   この記事を投稿するコンポーネント。
   Firebase Firestore にタイトルや本文、編集者などを保存し、
   Base64形式の画像をGitHubにアップロードしてURL化する。
   なお、Markdownエディタは自作し、ツールバー付きのGUIエディタと
   プレビューが常に並列表示されるように実装しています。
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

// Markdown を HTML に変換するための marked ライブラリをインport
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

  // 送信ボタンの連打防止用状態
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Markdownエディタ用のテキストエリア参照（カーソル位置制御用）
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  // テキストエリアのカーソル位置に文字列を挿入する関数
  // --------------------------------------------
  const insertAtCursor = (textToInsert: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = markdownContent.substring(0, start);
      const after = markdownContent.substring(end);
      const newText = before + textToInsert + after;
      setMarkdownContent(newText);
      // カーソル位置を調整
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
      }, 0);
    } else {
      setMarkdownContent(markdownContent + textToInsert);
    }
  };

  // --------------------------------------------
  // ツールバー用各種挿入関数
  // --------------------------------------------
  const handleBold = () => {
    // 太字: **テキスト**
    insertAtCursor("**太字**");
  };

  const handleItalic = () => {
    // 斜体: _テキスト_
    insertAtCursor("_斜体_");
  };

  const handleLink = () => {
    // リンク: [リンクテキスト](URL)
    insertAtCursor("[リンクテキスト](https://example.com)");
  };

  const handleImage = () => {
    // 画像: ![代替テキスト](画像URL)
    insertAtCursor("![代替テキスト](https://example.com/image.jpg)");
  };

  const handleTable = () => {
    // 簡単な表のテンプレート
    const tableSnippet =
`| 見出し1 | 見出し2 | 見出し3 |
| --- | --- | --- |
| データ1 | データ2 | データ3 |

`;
    insertAtCursor(tableSnippet);
  };

  const handleHorizontalRule = () => {
    // 水平線
    insertAtCursor("\n---\n");
  };

  const handleColoredText = () => {
    // HTMLタグで色指定（Markdown内でHTMLが利用可能な場合）
    insertAtCursor("<span style='color: red;'>赤色のテキスト</span>");
  };

  const handleCodeBlock = () => {
    // コードブロック
    insertAtCursor("\n```\nコード例\n```\n");
  };

  // --------------------------------------------
  // フォーム送信処理
  // --------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // 連打防止
    setIsSubmitting(true);
    try {
      // 自作エディタからMarkdownコンテンツを取得
      let content = markdownContent;
      // Markdown内のBase64画像をGitHubにアップロードしてURLを置換
      content = await processMarkdownContent(content);

      // Firestoreに記事を保存
      const articleId = nanoid(10); // ユニークな記事ID生成
      const articleRef = doc(db, "articles", articleId);

      // チェックボックスの状態によりdiscordフィールドの値を設定
      const discordValue = introduceDiscord ? false : true;

      await setDoc(articleRef, {
        title,
        content,
        created_at: serverTimestamp(),
        authorId: userId, // 正しいユーザーIDを設定
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((editor) => editor.uid),
        // ======== 追加: discordフィールド（Boolean） ========
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
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------
  // Markdown内のBase64画像をGitHubにアップロードしてURLを置換する関数
  // --------------------------------------------
  /**
   * Markdownコンテンツ内のBase64画像を検出し、GitHubにアップロードしてURLを置換する関数
   *
   * @param markdown - 元のMarkdownコンテンツ
   * @returns 画像URLが置換されたMarkdownコンテンツ
   */
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    // Base64形式の画像を検出する正規表現
    const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/[a-zA-Z]+;base64,([^)]+))\)/g;
    // 画像アップロードのプロミスを格納する配列
    const uploadPromises: Promise<void>[] = [];
    // マッチしたBase64画像とGitHubのURLの対応を保存するオブジェクト
    const base64ToGitHubURLMap: { [key: string]: string } = {};

    let match;
    while ((match = base64ImageRegex.exec(markdown)) !== null) {
      const [fullMatch, /* altText */, dataUrl, base64Data] = match;
      // 同じ画像を複数回アップロードしない
      if (base64ToGitHubURLMap[dataUrl]) continue;

      const uploadPromise = (async () => {
        try {
          const imageUrl = await uploadBase64ImageToGitHub(base64Data, fullMatch);
          base64ToGitHubURLMap[dataUrl] = imageUrl;
        } catch (error) {
          console.error("画像のアップロードに失敗しました:", error);
          alert("画像のアップロードに失敗しました。");
          throw error;
        }
      })();
      uploadPromises.push(uploadPromise);
    }

    await Promise.all(uploadPromises);

    // Markdown内のBase64画像URLをGitHubのURLに置換
    const updatedMarkdown = markdown.replace(base64ImageRegex, (match, alt, dataUrl) => {
      const githubUrl = base64ToGitHubURLMap[dataUrl];
      return githubUrl ? `![${alt}](${githubUrl})` : match;
    });

    return updatedMarkdown;
  };

  // --------------------------------------------
  // FirestoreからGitHubトークンを取得する関数
  // --------------------------------------------
  async function fetchGithubToken() {
    try {
      const docRef = doc(db, "keys", "AjZSjYVj4CZSk1O7s8zG"); // 正しいドキュメントIDを指定
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.key; // "key"フィールドの値を返す
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
  // GitHubにBase64画像をアップロードする関数
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
    let imageType = "png";
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }
    const id = nanoid(10); // 10文字のユニークID
    const fileName = `${id}.${imageType}`;
    const fileApiUrl = `${GITHUB_API_URL}${fileName}`;
    const payload = {
      message: `Add image: ${fileName}`,
      content: base64Data,
    };
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
    const imageUrl = `https://github.com/ASK-STEM-official/Image-Storage/raw/main/static/images/${fileName}`;
    return imageUrl;
  };

  // --------------------------------------------
  // コンポーネントの描画
  // --------------------------------------------
  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">記事を追加</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* タイトル入力 */}
        <div className="form-group">
          <label htmlFor="title" className="block text-gray-700 dark:text-gray-300">タイトル</label>
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
          <label className="block text-gray-700 dark:text-gray-300 mb-2">編集者を追加</label>
          <input
            type="text"
            placeholder="編集者を検索"
            value={editorSearch}
            onChange={(e) => setEditorSearch(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {editorSearch && (
            <ul className="border border-gray-300 dark:border-gray-600 mt-2 max-h-40 overflow-y-auto">
              {allUsers
                .filter(
                  (user) =>
                    user.displayName.toLowerCase().includes(editorSearch.toLowerCase()) &&
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
                      <span className="text-gray-800 dark:text-gray-100">{user.displayName}</span>
                    </div>
                  </li>
                ))}
              {allUsers.filter(
                (user) =>
                  user.displayName.toLowerCase().includes(editorSearch.toLowerCase()) &&
                  user.uid !== userId &&
                  !selectedEditors.find((editor) => editor.uid === user.uid)
              ).length === 0 && (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400">該当するユーザーが見つかりません。</li>
              )}
            </ul>
          )}
        </div>

        {/* 選択された編集者の表示 */}
        {selectedEditors.length > 0 && (
          <div className="form-group">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">現在の編集者</label>
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
                    <span className="text-gray-800 dark:text-gray-100">{editor.displayName}</span>
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

        {/* 自作の Markdown エディタ（ツールバー付き・エディタとプレビューを並列表示） */}
        <div className="form-group">
          {/* ツールバー */}
          <div className="toolbar mb-2">
            <button type="button" onClick={handleBold} className="btn-toolbar">太字</button>
            <button type="button" onClick={handleItalic} className="btn-toolbar">斜体</button>
            <button type="button" onClick={handleLink} className="btn-toolbar">リンク</button>
            <button type="button" onClick={handleImage} className="btn-toolbar">画像</button>
            <button type="button" onClick={handleTable} className="btn-toolbar">表</button>
            <button type="button" onClick={handleHorizontalRule} className="btn-toolbar">水平線</button>
            <button type="button" onClick={handleColoredText} className="btn-toolbar">色付きテキスト</button>
            <button type="button" onClick={handleCodeBlock} className="btn-toolbar">コードブロック</button>
          </div>
          {/* エディタとプレビューをグリッド表示 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 編集用テキストエリア */}
            <textarea
              ref={textareaRef}
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              className="w-full h-64 p-2 border rounded bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ここにMarkdownを入力"
            />
            {/* プレビュ―パネル：Markdown を HTML に変換して表示 */}
            <div
              className="w-full h-64 p-2 border rounded bg-white dark:bg-gray-700 dark:text-white overflow-auto markdown-preview"
              dangerouslySetInnerHTML={{ __html: marked(markdownContent) }}
            />
          </div>
        </div>

        {/* 投稿ボタン（連打防止機能付き） */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isSubmitting ? "送信中..." : "投稿"}
        </button>
      </form>
    </div>
  );
};

export default AddArticle;

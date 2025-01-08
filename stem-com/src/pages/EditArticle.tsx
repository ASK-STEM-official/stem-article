// src/pages/EditArticle.tsx
import React, { useState, useRef, useEffect, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid"; // 短いユニークID生成用
import { Editor } from "@toast-ui/react-editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import colorSyntax from "@toast-ui/editor-plugin-color-syntax";
import "@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css"; // 必要に応じてCSSをインポート

// Import custom CSS for editor styling
import "../AddArticle.css";

// ユーザーの型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl?: string;
}

// 記事の型定義
interface Article {
  id: string;
  title: string;
  content: string;
  created_at: {
    seconds: number;
    nanoseconds: number;
  };
  authorId: string;
  authorAvatarUrl?: string;
  editors?: string[]; // 編集者のUIDの配列
}

const EditArticle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null); // ユーザーIDを保持するステート
  const editorRef = useRef<Editor>(null);
  const navigate = useNavigate();
  const auth = getAuth();

  // Removed unused variables
  // const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [allUsers, setAllUsers] = useState<UserData[]>([]); // 全ユーザーのリスト
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]); // 選択された編集者
  const [editorSearch, setEditorSearch] = useState<string>(""); // 編集者検索用のステート
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 認証状態の監視
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserAvatar(user.photoURL || null); // Ensure userAvatar is used or remove it
      } else {
        setUserId(null);
        setUserAvatar(null);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) {
        navigate('/');
        return;
      }

      try {
        // 記事を取得
        const docRef = doc(db, "articles", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Article;
          setArticle({
            id: docSnap.id,
            ...data,
          });
          setTitle(data.title);

          // 編集者のデータを取得
          if (data.editors && Array.isArray(data.editors)) {
            const editorsData: UserData[] = [];
            for (const editorId of data.editors) {
              const editorDocRef = doc(db, "users", editorId);
              const editorDoc = await getDoc(editorDocRef);

              if (editorDoc.exists()) {
                const editorData = editorDoc.data();
                editorsData.push({
                  uid: editorDoc.id,
                  displayName: editorData.displayName || "ユーザー",
                  avatarUrl: editorData.avatarUrl || undefined,
                });
              } else {
                editorsData.push({
                  uid: editorId,
                  displayName: "ユーザー",
                  avatarUrl: undefined,
                });
              }
            }
            setSelectedEditors(editorsData);
          }
        } else {
          setError("記事が存在しません。");
          navigate('/');
        }
      } catch (error) {
        console.error("Error fetching article:", error);
        setError("記事の取得に失敗しました。");
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, navigate]);

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

    if (!article) {
      alert("編集対象の記事が見つかりません。");
      return;
    }

    try {
      const editorInstance = editorRef.current?.getInstance();
      let markdownContent = editorInstance?.getMarkdown() || "";

      // 投稿時に画像を処理
      markdownContent = await processMarkdownContent(markdownContent);

      // Firestoreに更新
      const articleRef = doc(db, "articles", article.id);
      await setDoc(articleRef, {
        title,
        content: markdownContent,
        updated_at: serverTimestamp(),
        editors: selectedEditors.map((editor) => editor.uid), // 編集者のUIDを保存
      }, { merge: true });

      alert("記事を更新しました！");
      navigate(`/articles/${article.id}`);
    } catch (error) {
      console.error("エラー:", error);
      alert("記事の更新に失敗しました。");
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
    const base64ImageRegex =
      /!\[([^\]]*)\]\((data:image\/[a-zA-Z]+;base64,([^)]+))\)/g;

    const uploadPromises: Promise<void>[] = [];
    const base64ToGitHubURLMap: { [key: string]: string } = {};

    const matches = Array.from(markdown.matchAll(base64ImageRegex));

    matches.forEach(match => {
      const dataUrl = match[2];
      const base64Data = match[3];

      if (!base64ToGitHubURLMap[dataUrl]) {
        uploadPromises.push(
          uploadBase64ImageToGitHub(base64Data, match[0])
            .then(imageUrl => {
              base64ToGitHubURLMap[dataUrl] = imageUrl;
            })
            .catch(error => {
              console.error("画像のアップロードに失敗しました:", error);
              alert("画像のアップロードに失敗しました。");
              throw error;
            })
        );
      }
    });

    await Promise.all(uploadPromises);

    const updatedMarkdown = markdown.replace(
      base64ImageRegex,
      (match, alt, dataUrl, base64Data) => {
        const githubUrl = base64ToGitHubURLMap[dataUrl];
        if (githubUrl) {
          return `![${alt}](${githubUrl})`;
        }
        return match;
      }
    );

    return updatedMarkdown;
  };

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
      message: `Update image: ${fileName}`,
      content: base64Data,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-center text-red-500">{error || "記事が見つかりません。"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        記事を編集
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
            initialValue={article.content}
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
          更新
        </button>
      </form>
    </div>
  );
};

export default EditArticle;

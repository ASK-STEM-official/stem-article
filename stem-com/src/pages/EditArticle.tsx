// src/pages/EditArticle.tsx
// このファイルは記事編集用コンポーネントです。
// ツールバー付きのオリジナル Markdown エディタを実装しており、
// 左側に入力エリア（ツールバー＋テキストエリア）、右側にリアルタイムプレビューを表示します。
// 画像追加ボタンでは、画像ファイルを Base64 形式に変換した上で、テキストエリアには短いプレースホルダー（例："temp://ID"）を挿入し、
// プレビューではそのプレースホルダーに対応する Base64 画像を表示、投稿時は GitHub にアップロードして URL に置換します.

import React, { useState, useEffect, FormEvent, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid"; // ユニークID生成用ライブラリ
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "../AddArticle.css";

// ユーザー情報の型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

// 記事の型定義
interface Article {
  id: string;
  title: string;
  content: string;
  created_at?: {
    seconds: number;
    nanoseconds: number;
  };
  authorId: string;
  authorAvatarUrl?: string;
  editors?: string[]; // 編集者のUIDの配列
}

const EditArticle: React.FC = () => {
  // URLパラメータから記事IDを取得
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 以下の state は将来的に利用するため、ESLint の警告を無視
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [article, setArticle] = useState<Article | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState<boolean>(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  // 画像のプレースホルダーと Base64 データの対応マッピング
  const [imageMapping, setImageMapping] = useState<{ [key: string]: { base64: string; filename: string } }>({});
  // 連打防止用の状態
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Firebase 認証
  const auth = getAuth();

  // テキストエリアの参照（カーソル位置取得・操作に利用）
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ----------------------------
  // FirebaseAuth のユーザーログイン状態を監視
  // ----------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setUserId(user.uid);
        setUserAvatar(user.photoURL || null);
      } else {
        setUserId(null);
        setUserAvatar(null);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  // ----------------------------
  // Firestore の users コレクションから全ユーザーを取得
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
  // 編集対象の記事を取得する
  // ----------------------------
  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) {
        navigate("/");
        return;
      }
      try {
        const docRef = doc(db, "articles", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Article;
          const fetchedArticle: Article = { id: docSnap.id, ...data };
          setArticle(fetchedArticle);
          setTitle(fetchedArticle.title);
          setMarkdownContent(fetchedArticle.content);
          if (fetchedArticle.editors && Array.isArray(fetchedArticle.editors)) {
            const editorsData: UserData[] = [];
            for (const editorId of fetchedArticle.editors) {
              const userDocRef = doc(db, "users", editorId);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const userData = userDoc.data();
                editorsData.push({
                  uid: userDoc.id,
                  displayName: userData.displayName || "ユーザー",
                  avatarUrl: userData.avatarUrl || "",
                });
              }
            }
            setSelectedEditors(editorsData);
          }
        } else {
          setArticle(null);
          navigate("/");
        }
      } catch (error) {
        console.error("記事の取得に失敗しました:", error);
        setError("記事の取得に失敗しました。");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id, navigate]);

  // ----------------------------
  // 編集者を追加する処理
  // ----------------------------
  const handleAddEditor = (user: UserData) => {
    if (selectedEditors.find((editor) => editor.uid === user.uid)) return;
    setSelectedEditors([...selectedEditors, user]);
    setEditorSearch("");
  };

  // ----------------------------
  // 選択された編集者を削除する処理
  // ----------------------------
  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

  // ----------------------------
  // テキストエリアのカーソル位置に指定の文字列を挿入する関数
  // ----------------------------
  const insertAtCursor = (textToInsert: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = markdownContent.substring(0, start);
      const after = markdownContent.substring(end);
      const newContent = before + textToInsert + after;
      setMarkdownContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
      }, 0);
    }
  };

  // ----------------------------
  // 画像アップロードモーダル内でのアップロード処理（連打防止のため isUploading 状態を利用）
  // ----------------------------
  const handleUploadImage = () => {
    if (!selectedImageFile) {
      alert("画像ファイルを選択してください。");
      return;
    }
    if (isUploading) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(selectedImageFile);
    reader.onload = () => {
      const result = reader.result as string;
      const id = nanoid(6);
      const placeholderUrl = `temp://${id}`;
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholderUrl})\n`;
      setMarkdownContent((prev) => prev + imageMarkdown);
      setImageMapping((prev) => ({ ...prev, [id]: { base64: result, filename: selectedImageFile.name } }));
      setShowImageModal(false);
      setSelectedImageFile(null);
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("画像の読み込みに失敗しました。");
      setIsUploading(false);
    };
  };

  // ----------------------------
  // Markdown 内のプレースホルダー画像を GitHub にアップロードして URL に置換する処理
  // ----------------------------
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    // プレースホルダー形式： temp://ID
    const placeholderRegex = /!\[([^\]]*)\]\((temp:\/\/([a-zA-Z0-9]+))\)/g;
    const uploadPromises: Promise<void>[] = [];
    const placeholderToURL: { [key: string]: string } = {};

    let match;
    while ((match = placeholderRegex.exec(markdown)) !== null) {
      // 必要な値のみ取得（最初の2要素は破棄）
      const [, , placeholder, id] = match;
      if (placeholderToURL[placeholder]) continue;
      const uploadPromise = (async () => {
        if (imageMapping[id]) {
          try {
            const extMatch = imageMapping[id].filename.match(/\.([a-zA-Z0-9]+)$/);
            const imageType = extMatch && extMatch[1] ? extMatch[1] : "png";
            const dummyOriginalMatch = `data:image/${imageType};base64,`;
            const imageUrl = await uploadBase64ImageToGitHub(imageMapping[id].base64, dummyOriginalMatch);
            placeholderToURL[placeholder] = imageUrl;
          } catch (error) {
            console.error("画像のアップロードに失敗しました:", error);
            throw error;
          }
        }
      })();
      uploadPromises.push(uploadPromise);
    }
    await Promise.all(uploadPromises);
    const updatedMarkdown = markdown.replace(
      placeholderRegex,
      (match, altText, placeholder, id) => {
        const url = placeholderToURL[placeholder];
        return url ? `![${altText}](${url})` : match;
      }
    );
    return updatedMarkdown;
  };

  // ----------------------------
  // Firestore から GitHub トークンを取得する処理
  // ----------------------------
  async function fetchGithubToken() {
    try {
      const docRef = doc(db, "keys", "AjZSjYVj4CZSk1O7s8zG");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.key;
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
  // GitHub に Base64 画像をアップロードする処理
  // ----------------------------
  const uploadBase64ImageToGitHub = async (
    base64Data: string,
    originalMatch: string
  ): Promise<string> => {
    const GITHUB_API_URL = `https://api.github.com/repos/ASK-STEM-official/Image-Storage/contents/static/images/`;
    const GITHUB_TOKEN = await fetchGithubToken();
    const imageTypeMatch = originalMatch.match(/data:image\/([a-zA-Z]+);base64,/);
    let imageType = "png";
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }
    const id = nanoid(10);
    const fileName = `${id}.${imageType}`;
    const fileApiUrl = `${GITHUB_API_URL}${fileName}`;
    const pureBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const payload = {
      message: `Add image: ${fileName}`,
      content: pureBase64,
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

  // ----------------------------
  // フォーム送信時の処理（連打防止のため isSubmitting 状態を利用）
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let content = markdownContent;
      content = await processMarkdownContent(content);
      // ここでは記事の更新（merge:true）ではなく、新規追加として扱っています
      // 必要に応じて、merge: true を利用してください。
      const articleId = nanoid(10);
      const articleRef = doc(db, "articles", articleId);
      await setDoc(
        articleRef,
        {
          title,
          content,
          created_at: serverTimestamp(),
          authorId: userId,
          authorAvatarUrl: userAvatar,
          editors: selectedEditors.map((editor) => editor.uid),
        },
        { merge: true }
      );
      alert("記事を追加しました！");
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      navigate("/");
    } catch (error) {
      console.error("エラー:", error);
      alert("記事の投稿に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        記事を編集
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

        {/* オリジナル Markdown エディタ GUI */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            内容 (Markdown)
          </label>
          <div className="flex flex-col md:flex-row gap-4">
            {/* 左側：ツールバー付き入力エリア */}
            <div className="w-full md:w-1/2">
              {/* ツールバー */}
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertAtCursor("# ")}
                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                >
                  見出し
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor("**太字**")}
                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                >
                  太字
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor("*斜体*")}
                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                >
                  斜体
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor("[リンク](http://)")}
                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                >
                  リンク
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor("```\nコード\n```")}
                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                >
                  コードブロック
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor("- ")}
                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                >
                  リスト
                </button>
                <button
                  type="button"
                  onClick={() => insertAtCursor("> ")}
                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                >
                  引用
                </button>
              </div>
              {/* テキストエリア（Markdown 入力） */}
              <textarea
                ref={textareaRef}
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="ここに Markdown を入力"
                className="w-full h-80 p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
              />
              {/* 画像追加ボタン */}
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                画像追加
              </button>
            </div>
            {/* 右側：リアルタイムプレビュー */}
            <div className="w-full md:w-1/2 overflow-y-auto p-2 border rounded bg-white dark:bg-gray-700 dark:text-white">
              {markdownContent.trim() ? (
                <div className="prose prose-indigo max-w-none dark:prose-dark">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // img 要素のカスタムレンダリング： プレースホルダーの場合は imageMapping から Base64 データを取得
                      img: ({ node, ...props }) => {
                        if (
                          props.src &&
                          typeof props.src === "string" &&
                          props.src.startsWith("temp://")
                        ) {
                          const id = props.src.replace("temp://", "");
                          if (imageMapping[id]) {
                            return (
                              <img
                                {...props}
                                src={imageMapping[id].base64}
                                alt={props.alt || `画像: ${imageMapping[id].filename}`}
                                style={{ maxWidth: "100%" }}
                              />
                            );
                          }
                        }
                        return <img {...props} alt={props.alt || ""} style={{ maxWidth: "100%" }} />;
                      },
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {markdownContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-500">プレビューがここに表示されます</p>
              )}
            </div>
          </div>
        </div>

        {/* 投稿ボタン（連打防止のため isSubmitting 状態を利用） */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          更新
        </button>
      </form>

      {/* 画像アップロード用モーダル */}
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
                disabled={isUploading}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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

export default EditArticle;

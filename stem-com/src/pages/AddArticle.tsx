// src/pages/AddArticle.tsx
// このファイルは記事投稿用コンポーネントです。
// ツールバー付きのオリジナル Markdown エディタを実装しており、
// 左側に入力エリア（ツールバー＋テキストエリア）、右側にリアルタイムプレビューを表示します。
// 画像追加ボタンでは、画像ファイルを Base64 形式に変換した上で、テキストエリアには短いプレースホルダー（例："temp://ID"）を挿入し、
// プレビューではそのプレースホルダーに対応する Base64 画像を表示、投稿時は GitHub にアップロードして URL に置換します.

import React, { useState, useEffect, FormEvent, useRef } from "react";
// Firebase Firestore 関連のインポート
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
// Firebase Authentication 関連のインポート
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
// Markdown のリアルタイムプレビュー用ライブラリ
import ReactMarkdown from "react-markdown";
// GitHub Flavored Markdown (GFM) を有効にするための remark プラグイン
import remarkGfm from "remark-gfm";
// コードブロックのシンタックスハイライト用コンポーネントのインポート
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
// カスタムCSS のインポート（必要に応じて編集）
import "../AddArticle.css";

// ユーザー情報の型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

const AddArticle: React.FC = () => {
  // ----------------------------
  // 各種状態管理
  // ----------------------------
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");

  // Discord 関連（不要な場合は削除）
  const [introduceDiscord, setIntroduceDiscord] = useState<boolean>(false);

  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // 画像のプレースホルダーと Base64 データの対応マッピング
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});

  // 連打防止用の状態
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 画面遷移用
  const navigate = useNavigate();
  // Firebase 認証インスタンスの取得
  const auth = getAuth();

  // テキストエリアの参照を作成（カーソル位置取得・操作に利用）
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
  // 編集者を追加する処理
  // ----------------------------
  const handleAddEditor = (user: UserData) => {
    if (selectedEditors.some((editor) => editor.uid === user.uid)) return;
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

      // カーソルを挿入テキストの後ろに移動
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
      }, 0);
    }
  };

  // ----------------------------
  // 画像アップロードモーダル内でのアップロード処理
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
      const base64Result = reader.result as string;
      // プレースホルダー用の短い ID を生成
      const id = nanoid(6);
      const placeholderUrl = `temp://${id}`;

      // Markdown に挿入する形を改行付きにするかどうかは好みで調整
      // ここでは改行つきで挿入
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholderUrl})\n`;

      // テキストエリアに挿入
      setMarkdownContent((prev) => prev + imageMarkdown);

      // 画像の Base64 データとファイル名を mapping に登録
      setImageMapping((prev) => ({
        ...prev,
        [id]: { base64: base64Result, filename: selectedImageFile.name },
      }));

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
  // Markdown 内のプレースホルダー画像を GitHub にアップロードして URL に置換
  // ----------------------------
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    // temp://xxxxxx 形式をマッチ
    const placeholderRegex = /!\[([^\]]*)\]\((temp:\/\/([a-zA-Z0-9_-]+))\)/g;

    const uploadPromises: Promise<void>[] = [];
    const placeholderToURL: { [key: string]: string } = {};

    let match: RegExpExecArray | null;
    while ((match = placeholderRegex.exec(markdown)) !== null) {
      // destructuring で不要な変数を _unusedXxxx などにして ESLint 警告を回避
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [fullMatch, _unusedAltText, placeholder, id] = match;

      if (!placeholderToURL[placeholder]) {
        const uploadPromise = (async () => {
          try {
            const mappingItem = imageMapping[id];
            if (!mappingItem) return;

            // 拡張子を取得（なければ png）
            const extMatch = mappingItem.filename.match(/\.([a-zA-Z0-9]+)$/);
            const imageType = extMatch && extMatch[1] ? extMatch[1] : "png";
            const dummyOriginal = `data:image/${imageType};base64,`;

            const uploadedUrl = await uploadBase64ImageToGitHub(mappingItem.base64, dummyOriginal);
            placeholderToURL[placeholder] = uploadedUrl;
          } catch (error) {
            console.error("画像のアップロードに失敗しました:", error);
            throw error;
          }
        })();

        uploadPromises.push(uploadPromise);
      }
    }

    await Promise.all(uploadPromises);

    // 置換
    const updated = markdown.replace(
      placeholderRegex,
      (match, altText, placeholder, id) => {
        const url = placeholderToURL[placeholder];
        return url ? `![${altText}](${url})` : match;
      }
    );

    return updated;
  };

  // ----------------------------
  // Firestore から GitHub トークンを取得する関数
  // ----------------------------
  async function fetchGithubToken() {
    try {
      const docRef = doc(db, "keys", "AjZSjYVj4CZSk1O7s8zG");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.key as string;
      } else {
        console.error("Document not found!");
        return "";
      }
    } catch (error) {
      console.error("Error fetching token:", error);
      return "";
    }
  }

  // ----------------------------
  // GitHub へ Base64 画像をアップロードする関数
  // ----------------------------
  const uploadBase64ImageToGitHub = async (
    base64Data: string,
    original: string
  ): Promise<string> => {
    const GITHUB_API_URL = `https://api.github.com/repos/ASK-STEM-official/Image-Storage/contents/static/images/`;
    const token = await fetchGithubToken();

    // 画像タイプを取り出し（なければ png）
    const imageTypeMatch = original.match(/data:image\/([a-zA-Z]+);base64,/);
    let imageType = "png";
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }

    const fileId = nanoid(10);
    const fileName = `${fileId}.${imageType}`;
    const fileApiUrl = `${GITHUB_API_URL}${fileName}`;

    // base64Data に "data:image/xxx;base64," が含まれていれば除去
    const pureBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

    const payload = {
      message: `Add image: ${fileName}`,
      content: pureBase64,
    };

    const resp = await fetch(fileApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errJson = await resp.json();
      throw new Error(errJson.message);
    }

    const imageUrl = `https://github.com/ASK-STEM-official/Image-Storage/raw/main/static/images/${fileName}`;
    return imageUrl;
  };

  // ----------------------------
  // フォーム送信時の処理
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // 1. Markdown 内の画像プレースホルダーを GitHub URL に置換
      let content = markdownContent;
      content = await processMarkdownContent(content);

      // 2. Firestore に記事情報を格納
      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);

      // Discord 用フラグの制御（false で紹介、true で無視 ...などは環境に合わせて）
      const discordValue = introduceDiscord ? false : true;

      await setDoc(docRef, {
        title,
        content,
        created_at: serverTimestamp(),
        authorId: userId,
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((editor) => editor.uid),
        discord: discordValue,
      });

      alert("記事を追加しました！");
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      setIntroduceDiscord(false);

      // 投稿後に一覧ページへ
      navigate("/");
    } catch (err) {
      console.error("エラー:", err);
      alert("記事の投稿に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* Discord 紹介チェックボックス（不要なら削除） */}
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
                placeholder="ここにMarkdownを入力"
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
                <div
                  className="prose prose-indigo max-w-none dark:prose-dark"
                  key={markdownContent + JSON.stringify(imageMapping)}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // img 要素のカスタムレンダリング
                      img: ({ node, ...props }) => {
                        if (
                          props.src &&
                          typeof props.src === "string" &&
                          props.src.startsWith("temp://")
                        ) {
                          const id = props.src.replace("temp://", "");
                          if (imageMapping[id]?.base64?.startsWith("data:")) {
                            return (
                              <img
                                {...props}
                                src={imageMapping[id].base64}
                                alt={props.alt || `画像: ${imageMapping[id].filename}`}
                                style={{ maxWidth: "100%" }}
                              />
                            );
                          } else {
                            return <span style={{ color: "red" }}>画像読み込みエラー</span>;
                          }
                        }
                        return (
                          <img
                            {...props}
                            alt={props.alt || ""}
                            style={{ maxWidth: "100%" }}
                          />
                        );
                      },

                      // コードブロックのカスタムレンダリング
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

        {/* 投稿ボタン（連打防止） */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          投稿
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

export default AddArticle;

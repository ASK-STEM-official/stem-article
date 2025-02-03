// src/pages/AddArticle.tsx

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
// コードブロックのシンタックスハイライト用コンポーネント
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
// カスタムCSS のインポート
import "../AddArticle.css";

// ユーザー情報の型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * AddArticle コンポーネント
 * 記事投稿ページ。タイトル、Markdown 形式の本文、編集者の追加や画像のアップロードを行い、
 * Firestore に記事を保存する。
 */
const AddArticle: React.FC = () => {
  // ----------------------------
  // 各種状態管理
  // ----------------------------
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");

  // Discord 関連（不要な場合は削除）
  const [introduceDiscord, setIntroduceDiscord] = useState<boolean>(false);

  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // 画像のプレースホルダーと Base64 データの対応マッピング
  // ※アップロード時に生成した "temp://xxxx" のIDと、Base64画像データ・ファイル名を紐付ける
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});

  // 連打防止用の状態
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const navigate = useNavigate();
  const auth = getAuth();

  // テキストエリア参照（Markdown入力エリア用）
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ----------------------------
  // FirebaseAuth のログイン状態監視
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
  // Firestore の users コレクション取得
  // ----------------------------
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersCol = collection(db, "users");
        const userSnapshot = await getDocs(usersCol);
        const usersList = userSnapshot.docs.map((doc) => ({
          uid: doc.id,
          displayName: doc.data().displayName,
          avatarUrl: doc.data().avatarUrl,
        }));
        setAllUsers(usersList);
      } catch (error) {
        console.error("ユーザーの取得に失敗:", error);
      }
    };
    fetchUsers();
  }, []);

  // ----------------------------
  // 編集者を追加する処理
  // ----------------------------
  const handleAddEditor = (user: UserData) => {
    if (!selectedEditors.some((editor) => editor.uid === user.uid)) {
      setSelectedEditors([...selectedEditors, user]);
    }
    setEditorSearch("");
  };

  // ----------------------------
  // 選択された編集者を削除する処理
  // ----------------------------
  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

  // ----------------------------
  // テキストエリアのカーソル位置にテキストを挿入する処理
  // ----------------------------
  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return;

    const { selectionStart, selectionEnd } = textareaRef.current;
    const before = markdownContent.slice(0, selectionStart);
    const after = markdownContent.slice(selectionEnd);

    const updated = before + text + after;
    setMarkdownContent(updated);

    // 挿入後のカーソル位置を調整
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = selectionStart + text.length;
        textareaRef.current.selectionEnd = selectionStart + text.length;
      }
    }, 0);
  };

  // ----------------------------
  // 画像アップロードモーダル内での処理
  // ----------------------------
  // 画像ファイルを読み込み、Base64形式に変換後、Markdownに "temp://xxx" プレースホルダー付き記法を挿入
  const handleUploadImage = () => {
    if (!selectedImageFile) {
      alert("画像ファイルを選択してください。");
      return;
    }
    if (isUploading) return;

    setIsUploading(true);

    const reader = new FileReader();
    // FileReaderで画像ファイルを読み込み、Base64データを取得する
    reader.onload = () => {
      const base64Data = reader.result as string;
      const id = nanoid(6); // ユニークなID生成
      const placeholder = `temp://${id}`;

      // 改行ありのMarkdown記法で画像を挿入
      // 左側のエディタには "temp://xxxx" のプレースホルダーで表示され、後でプレビュー側でBase64画像に置換される
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholder})\n`;
      setMarkdownContent((prev) => prev + imageMarkdown);

      // imageMapping に画像のBase64データとファイル名を登録
      setImageMapping((prev) => ({
        ...prev,
        [id]: { base64: base64Data, filename: selectedImageFile.name },
      }));

      setShowImageModal(false);
      setSelectedImageFile(null);
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("画像の読み込みに失敗しました。");
      setIsUploading(false);
    };
    reader.readAsDataURL(selectedImageFile);
  };

  // ----------------------------
  // Markdown 内のプレースホルダー画像を GitHub にアップロードし置換する処理
  // ※最終的な記事データ保存前に実行され、"temp://xxx" プレースホルダーを実際のアップロード先URLに置換する
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    const placeholderRegex = /!\[([^\]]*)\]\((temp:\/\/([a-zA-Z0-9_-]+))\)/g;
    const uploadPromises: Promise<void>[] = [];
    const placeholderToURL: { [key: string]: string } = {};

    let match: RegExpExecArray | null;
    while ((match = placeholderRegex.exec(markdown)) !== null) {
      // 使用しない変数は破棄するため、先頭2要素は無視する
      const [, , placeholder, id] = match;

      if (!placeholderToURL[placeholder]) {
        const p = (async () => {
          try {
            const entry = imageMapping[id];
            if (!entry) return;

            // 拡張子の取得
            const extMatch = entry.filename.match(/\.([a-zA-Z0-9]+)$/);
            const imageType = extMatch && extMatch[1] ? extMatch[1] : "png";

            const original = `data:image/${imageType};base64,`;
            // GitHub へアップロードし、アップロード先のURLを取得
            const uploadedUrl = await uploadBase64ImageToGitHub(entry.base64, original);
            placeholderToURL[placeholder] = uploadedUrl;
          } catch (err) {
            console.error("画像アップロード失敗:", err);
            throw err;
          }
        })();
        uploadPromises.push(p);
      }
    }

    // すべての画像アップロード完了後、Markdown内のプレースホルダーをアップロード先のURLに置換する
    await Promise.all(uploadPromises);
    const replaced = markdown.replace(
      placeholderRegex,
      (m, altText, placeholder, id) => {
        const url = placeholderToURL[placeholder];
        return url ? `![${altText}](${url})` : m;
      }
    );
    return replaced;
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
        if (data.key) {
          return data.key as string;
        }
      }
      console.error("GitHub トークンのドキュメントが見つかりません");
      return "";
    } catch (err) {
      console.error("GitHubトークン取得エラー:", err);
      return "";
    }
  }

  // ----------------------------
  // GitHub に Base64画像をアップロードする処理
  // ----------------------------
  const uploadBase64ImageToGitHub = async (
    base64Data: string,
    originalHead: string
  ): Promise<string> => {
    const token = await fetchGithubToken();
    const GITHUB_API_URL = `https://api.github.com/repos/ASK-STEM-official/Image-Storage/contents/static/images/`;

    // 画像タイプを抽出
    const imageTypeMatch = originalHead.match(/data:image\/([a-zA-Z]+);base64,/);
    let imageType = "png";
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }

    const uniqueId = nanoid(10);
    const fileName = `${uniqueId}.${imageType}`;
    const apiUrl = `${GITHUB_API_URL}${fileName}`;

    // base64Data に "data:image/xxx;base64," が含まれる場合は除去し、純粋なBase64文字列にする
    const pureBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

    const payload = {
      message: `Add image: ${fileName}`,
      content: pureBase64,
    };

    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message);
    }

    // GitHub 上の画像URLを返す
    return `https://github.com/ASK-STEM-official/Image-Storage/raw/main/static/images/${fileName}`;
  };

  // ----------------------------
  // フォーム送信時の処理
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      let content = markdownContent;
      // Markdown の画像プレースホルダーをアップロードして置換する
      content = await processMarkdownContent(content);

      // Firestore に記事を追加する
      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);
      const discordFlag = introduceDiscord ? false : true; // 環境に合わせて

      await setDoc(docRef, {
        title,
        content,
        created_at: serverTimestamp(),
        authorId: userId,
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((ed) => ed.uid),
        discord: discordFlag,
      });

      alert("記事を追加しました！");
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      setIntroduceDiscord(false);

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

        {/* Discordチェックボックス（不要なら削除） */}
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
                .filter((u) => {
                  const lowName = u.displayName.toLowerCase();
                  const lowSearch = editorSearch.toLowerCase();
                  return (
                    lowName.includes(lowSearch) &&
                    u.uid !== userId &&
                    !selectedEditors.find((ed) => ed.uid === u.uid)
                  );
                })
                .map((user) => (
                  <li
                    key={user.uid}
                    className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={() => handleAddEditor(user)}
                  >
                    <div className="flex items-center">
                      <img src={user.avatarUrl} alt={user.displayName} className="w-6 h-6 rounded-full mr-2" />
                      <span className="text-gray-800 dark:text-gray-100">{user.displayName}</span>
                    </div>
                  </li>
                ))}
              {allUsers.filter((u) => {
                const lowName = u.displayName.toLowerCase();
                const lowSearch = editorSearch.toLowerCase();
                return (
                  lowName.includes(lowSearch) &&
                  u.uid !== userId &&
                  !selectedEditors.find((ed) => ed.uid === u.uid)
                );
              }).length === 0 && (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400">該当するユーザーが見つかりません。</li>
              )}
            </ul>
          )}
        </div>

        {/* 選択された編集者 */}
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
                    <img src={editor.avatarUrl} alt={editor.displayName} className="w-6 h-6 rounded-full mr-2" />
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

        {/* Markdown エディタ部分 */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">内容 (Markdown)</label>
          <div className="flex flex-col md:flex-row gap-4">
            {/* 左側：テキストエリア＋ツールバー（編集用・プレーンテキスト） */}
            <div className="w-full md:w-1/2">
              <div className="mb-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => insertAtCursor("# ")} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                  見出し
                </button>
                <button type="button" onClick={() => insertAtCursor("**太字**")} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                  太字
                </button>
                <button type="button" onClick={() => insertAtCursor("*斜体*")} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                  斜体
                </button>
                <button type="button" onClick={() => insertAtCursor("[リンク](http://)") } className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                  リンク
                </button>
                <button type="button" onClick={() => insertAtCursor("```\nコード\n```")} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                  コードブロック
                </button>
                <button type="button" onClick={() => insertAtCursor("- ")} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                  リスト
                </button>
                <button type="button" onClick={() => insertAtCursor("> ")} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
                  引用
                </button>
              </div>

              <textarea
                ref={textareaRef}
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

            {/* 右側：プレビュー（Base64画像表示） */}
            <div className="w-full md:w-1/2 overflow-y-auto p-2 border rounded bg-white dark:bg-gray-700 dark:text-white">
              {markdownContent.trim() ? (
                <div className="prose prose-indigo max-w-none dark:prose-dark" key={markdownContent + JSON.stringify(imageMapping)}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // 画像コンポーネントのカスタムレンダラー
                      // src が "temp://xxxx" の場合、imageMapping から Base64データを取得して表示する
                      img: ({ node, ...props }) => {
                        if (
                          props.src &&
                          typeof props.src === "string" &&
                          props.src.startsWith("temp://")
                        ) {
                          const id = props.src.replace("temp://", "");
                          const mapped = imageMapping[id];
                          console.log("Custom image renderer: id =", id, "mapped =", mapped);
                          if (mapped) {
                            return (
                              <img
                                {...props}
                                src={mapped.base64}
                                alt={props.alt || `画像: ${mapped.filename}`}
                                style={{ maxWidth: "100%" }}
                              />
                            );
                          }
                          return <span style={{ color: "red" }}>画像読み込みエラー: {id}</span>;
                        }
                        // 通常の画像はそのままレンダリング
                        return <img {...props} alt={props.alt || ""} style={{ maxWidth: "100%" }} />;
                      },
                      // コードブロックのシンタックスハイライト
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
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
            <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">画像をアップロード</h2>
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

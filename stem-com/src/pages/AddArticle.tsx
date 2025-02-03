// src/pages/AddArticle.tsx

import React, { useState, useEffect, FormEvent, useRef } from "react";
/* 
  Firebase Firestore 関連のインポート 
  Firestore に記事やユーザー情報を保存・取得するためのメソッドを読み込む 
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

/* 
  nanoid はユニークなIDを生成するためのライブラリ 
  画像アップロード時などで一時的に一意なIDを発行したい場合に使用 
*/
import { nanoid } from "nanoid";
import { useNavigate } from "react-router-dom";

/* 
  Firebase Authentication 関連 
  ログイン状態の監視のために使用 
*/
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

/* 
  Markdown のリアルタイムプレビュー用ライブラリ 
  MarkdownをHTMLに変換してプレビューを可能にする 
*/
import ReactMarkdown from "react-markdown";

/* 
  GitHub Flavored Markdown (GFM) を有効にするための remark プラグイン 
  例) テーブル記法など 
*/
import remarkGfm from "remark-gfm";

/* 
  コードブロックのシンタックスハイライト用コンポーネント 
*/
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

/* 
  カスタムCSS のインポート 
  TailwindCSS のクラスと併用する場合などに使用 
*/
import "../AddArticle.css";

// ----------------------------
// ユーザー情報の型定義
// ----------------------------
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * AddArticle コンポーネント
 * 記事投稿ページ。タイトル、Markdown形式の本文、編集者の追加や画像のアップロードを行い、
 * Firestore に記事を保存する。
 */
const AddArticle: React.FC = () => {
  // ----------------------------
  // 状態管理用の useState フック
  // ----------------------------

  // 記事のタイトル
  const [title, setTitle] = useState<string>("");

  // Markdown形式のコンテンツ
  const [markdownContent, setMarkdownContent] = useState<string>("");

  // ログインユーザーのID, アイコンURL
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Firestore users コレクションから取得したすべてのユーザー
  const [allUsers, setAllUsers] = useState<UserData[]>([]);

  // 記事の共同編集者として追加されたユーザー
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);

  // 編集者の検索文字列
  const [editorSearch, setEditorSearch] = useState<string>("");

  // Discord に紹介するかどうかのフラグ（不要なら削除可能）
  const [introduceDiscord, setIntroduceDiscord] = useState<boolean>(false);

  // 画像アップロード用モーダルの表示/非表示
  const [showImageModal, setShowImageModal] = useState<boolean>(false);

  // 選択した画像ファイル
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  /* 
    画像のプレースホルダーと Base64 データの対応マッピング
    例) imageMapping[id] = { base64: "data:image/png;...", filename: "example.png" }
    Markdown中に "temp://xxx" という形で差し込んだIDと対応 
  */
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});

  // 連打防止用のフラグ
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 画像アップロード中のフラグ
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // React Router の画面遷移用
  const navigate = useNavigate();

  // Firebase Auth のインスタンスを取得
  const auth = getAuth();

  // テキストエリアの参照
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ----------------------------
  // FirebaseAuth のログイン状態監視
  // ----------------------------
  useEffect(() => {
    /* 
      onAuthStateChanged でログイン状態が変わるたびに呼ばれる 
      user が存在すればログイン済み、存在しなければログアウト状態 
    */
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
        // "users" コレクションを取得
        const usersCol = collection(db, "users");
        const userSnapshot = await getDocs(usersCol);

        // ドキュメントを配列に整形
        const usersList = userSnapshot.docs.map((doc) => ({
          uid: doc.id,
          displayName: doc.data().displayName,
          avatarUrl: doc.data().avatarUrl,
        }));

        setAllUsers(usersList);
        console.log("Debug: Fetched users:", usersList);
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
    // すでに選択済みの編集者でなければ追加
    if (!selectedEditors.some((editor) => editor.uid === user.uid)) {
      setSelectedEditors([...selectedEditors, user]);
    }
    // 検索フィールドをリセット
    setEditorSearch("");
  };

  // ----------------------------
  // 選択された編集者を削除する処理
  // ----------------------------
  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

  // ----------------------------
  // 画像アップロードモーダル内での処理
  // ----------------------------
  // 画像ファイルを選択・読み込み → Base64化 → Markdownに「temp://xxx」の形で差し込む
  const handleUploadImage = () => {
    if (!selectedImageFile) {
      alert("画像ファイルを選択してください。");
      return;
    }
    if (isUploading) return;
    setIsUploading(true);

    // FileReaderでBase64に変換
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const id = nanoid(6); // ユニークID生成
      const placeholder = `temp://${id}`;
      console.log("Debug: Uploaded image placeholder:", placeholder);

      // Markdown に画像記法を追加
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholder})\n`;
      setMarkdownContent((prev) => {
        const newContent = prev + imageMarkdown;
        console.log("Debug: Updated markdownContent:", newContent);
        return newContent;
      });

      // imageMapping に登録
      setImageMapping((prev) => {
        const newMapping = {
          ...prev,
          [id]: { base64: base64Data, filename: selectedImageFile.name },
        };
        console.log("Debug: Updated imageMapping in handleUploadImage:", newMapping);
        return newMapping;
      });

      // モーダルを閉じる
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
  // Markdown 内のプレースホルダー(temp://xxx)をGitHubにアップ後URLに置換
  // ----------------------------
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    /* 
      markdown中の ![alt](temp://some-id) を探す正規表現 
      例) ![画像: file.png](temp://abc123)
           ↑ altText         ↑ placeholder 全体(temp://abc123)    ↑ id(abc123)
    */
    const placeholderRegex = /!\[([^\]]*)\]\((temp:\/\/([a-zA-Z0-9_-]+))\)/g;

    // アップロードのPromiseを格納する配列
    const uploadPromises: Promise<void>[] = [];
    // プレースホルダーと実際のGitHub URLを対応させる
    const placeholderToURL: { [key: string]: string } = {};

    let match: RegExpExecArray | null;
    while ((match = placeholderRegex.exec(markdown)) !== null) {
      // match[0] は全文、[1]はaltText、[2]がtemp://xxx 全体、[3]がID部分
      const [, , placeholder, id] = match;
      console.log("Debug: Found placeholder in markdown:", placeholder, "with id:", id);

      // まだアップロードしていなければアップロードを行う
      if (!placeholderToURL[placeholder]) {
        const p = (async () => {
          try {
            const entry = imageMapping[id];
            if (!entry) {
              console.log("Debug: No imageMapping entry for id:", id);
              return;
            }
            // 拡張子を取得 (簡易的にファイル名から後ろを取り出す)
            const extMatch = entry.filename.match(/\.([a-zA-Z0-9]+)$/);
            const imageType = extMatch && extMatch[1] ? extMatch[1] : "png";
            const originalHead = `data:image/${imageType};base64,`;

            // GitHubにアップロードしてURLを取得
            const uploadedUrl = await uploadBase64ImageToGitHub(entry.base64, originalHead);
            console.log("Debug: Uploaded image URL for placeholder", placeholder, "->", uploadedUrl);

            // アップロード結果を保存
            placeholderToURL[placeholder] = `![${match![1]}](${uploadedUrl})`;
          } catch (err) {
            console.error("画像アップロード失敗:", err);
            throw err;
          }
        })();
        uploadPromises.push(p);
      }
    }

    // すべてのアップロード完了を待つ
    await Promise.all(uploadPromises);

    // 実際にMarkdown文字列中のプレースホルダーをアップロード後のURLに置換
    // ここでは ![alt](temp://xxx) 全体を ![alt](https://github.com/...png) に置換する
    const replaced = markdown.replace(
      placeholderRegex,
      (m, altText, placeholder) => {
        const url = placeholderToURL[placeholder];
        console.log("Debug: Replacing placeholder", placeholder, "with URL:", url);
        return url ? url : m;
      }
    );

    return replaced;
  };

  // ----------------------------
  // Firestore から GitHub トークンを取得する処理
  // ----------------------------
  async function fetchGithubToken() {
    try {
      // "keys" コレクションの "AjZSjYVj4CZSk1O7s8zG" ドキュメントに保存してあると仮定
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
  // GitHub に Base64画像をアップロードしてURLを取得する
  // ----------------------------
  const uploadBase64ImageToGitHub = async (
    base64Data: string,
    originalHead: string
  ): Promise<string> => {
    const token = await fetchGithubToken();
    // リポジトリ・ファイルパスは用途に合わせて変更してください
    const GITHUB_API_URL = `https://api.github.com/repos/ASK-STEM-official/Image-Storage/contents/static/images/`;

    // 画像タイプを抽出 (data:image/png;base64, の "png" 部分など)
    const imageTypeMatch = originalHead.match(/data:image\/([a-zA-Z]+);base64,/);
    let imageType = "png";
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }

    // ファイル名をユニークにするために nanoid を使用
    const uniqueId = nanoid(10);
    const fileName = `${uniqueId}.${imageType}`;
    const apiUrl = `${GITHUB_API_URL}${fileName}`;

    // Base64 の "data:image/xxx;base64," を除去
    const pureBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

    // GitHub API に送るpayload
    const payload = {
      message: `Add image: ${fileName}`,
      content: pureBase64,
    };

    // GitHub API (contents) にファイルをPUTリクエスト
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

    // アップロードした画像への生URL (raw) を返す
    const uploadedUrl = `https://github.com/ASK-STEM-official/Image-Storage/raw/main/static/images/${fileName}`;
    console.log("Debug: GitHub uploaded URL:", uploadedUrl);
    return uploadedUrl;
  };

  // ----------------------------
  // フォーム送信時の処理
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // 連続投稿防止
    setIsSubmitting(true);

    try {
      // Markdown中の画像プレースホルダーをアップロード済みURLに置換
      let content = await processMarkdownContent(markdownContent);

      // 記事IDを生成
      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);

      // Discordに紹介するかどうかのフラグ（必要に応じて変更）
      const discordFlag = introduceDiscord ? false : true;

      // Firestore に記事を登録
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

      // フォームリセット
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      setIntroduceDiscord(false);

      // 投稿完了後、トップページなどに遷移
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

      {/* 投稿フォーム */}
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
              {allUsers.filter((u) => {
                const lowName = u.displayName.toLowerCase();
                const lowSearch = editorSearch.toLowerCase();
                return (
                  lowName.includes(lowSearch) &&
                  u.uid !== userId &&
                  !selectedEditors.find((ed) => ed.uid === u.uid)
                );
              }).length === 0 && (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400">
                  該当するユーザーが見つかりません。
                </li>
              )}
            </ul>
          )}
        </div>

        {/* 選択された編集者リスト */}
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

        {/* Markdown エディタ部分 */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            内容 (Markdown)
          </label>
          <div className="flex flex-col md:flex-row gap-4">
            {/* 左側：テキストエリア（Markdown入力） */}
            <div className="w-full md:w-1/2">
              <textarea
                ref={textareaRef}
                value={markdownContent}
                onChange={(e) => {
                  setMarkdownContent(e.target.value);
                  console.log("Debug: markdownContent changed:", e.target.value);
                }}
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
                <div className="prose prose-indigo max-w-none dark:prose-dark">
                  <ReactMarkdown
                    /* GFMプラグインを有効にする */
                    remarkPlugins={[remarkGfm]}
                    /* 各要素（imgやcodeブロック）のレンダリングをカスタマイズ */
                    components={{
                      /* 
                        画像コンポーネントのカスタムレンダラー 
                        src が "temp://xxx" なら、imageMapping にあるBase64を表示する 
                      */
                      img: ({ node, ...props }) => {
                        if (
                          props.src &&
                          typeof props.src === "string" &&
                          props.src.startsWith("temp://")
                        ) {
                          const id = props.src.replace("temp://", "").trim();
                          const mapped = imageMapping[id];
                          console.log(
                            "Debug: Custom image renderer - id:",
                            id,
                            "mapped:",
                            mapped
                          );
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
                          return (
                            <span style={{ color: "red" }}>
                              画像読み込みエラー: {id}
                            </span>
                          );
                        }
                        // それ以外の通常画像
                        return (
                          <img
                            {...props}
                            alt={props.alt || ""}
                            style={{ maxWidth: "100%" }}
                          />
                        );
                      },
                      /* 
                        コードブロックのシンタックスハイライト 
                        ```js などの言語指定を正しくハイライトする 
                      */
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

        {/* 投稿ボタン */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          投稿
        </button>
      </form>

      {/* 画像アップロード用のモーダル */}
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
                  console.log("Debug: Selected image file:", e.target.files[0]);
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

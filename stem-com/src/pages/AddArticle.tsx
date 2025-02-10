// AddArticle.tsx
// このコンポーネントは記事投稿用ページです。
// タイトル、Markdown形式の本文、編集者の追加、画像アップロード機能、タグ付け機能を実装し、Firestore に記事を保存します。

import React, { useState, useEffect, FormEvent, useRef } from "react";
// Firebase Firestore 関連のインポート
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  getDoc,
  updateDoc, // ユーザーの経験値更新用に updateDoc を追加
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
 * 記事投稿ページ。タイトル、Markdown 形式の本文、編集者の追加、画像のアップロード、タグ付け機能を行い、
 * Firestore に記事を保存します。また、記事投稿時にユーザーの経験値（xp）を、記事の文字数に応じて加算し、
 * 経験値に基づいてレベルを更新します。
 */
const AddArticle: React.FC = () => {
  // ----------------------------
  // 各種状態管理
  // ----------------------------
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  // 編集者選択用状態
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");
  // 画像アップロード用状態
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  // 画像のプレースホルダーと Base64 データの対応マッピング
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});
  // 連打防止用の状態
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // ユーザー認証情報用状態
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // ----------------------------
  // タグ選択用状態
  // ----------------------------
  // Firestore に保存済みの全タグ一覧（文字列配列）
  const [allTags, setAllTags] = useState<string[]>([]);
  // ユーザーが選択したタグ
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // タグ検索・新規入力用の状態
  const [tagSearch, setTagSearch] = useState<string>("");

  // Discord 紹介用の状態（チェックボックスの値を管理）
  const [discordFlag, setDiscordFlag] = useState<boolean>(false);

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
        console.log("Debug: Fetched users:", usersList);
      } catch (error) {
        console.error("ユーザーの取得に失敗:", error);
      }
    };
    fetchUsers();
  }, []);

  // Firestore から全タグ（"tags" コレクション）を取得する処理
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tagsCol = collection(db, "tags");
        const tagsSnapshot = await getDocs(tagsCol);
        const tagsList = tagsSnapshot.docs.map((doc) => doc.data().name as string);
        setAllTags(tagsList);
        console.log("Debug: Fetched tags:", tagsList);
      } catch (error) {
        console.error("タグの取得に失敗:", error);
      }
    };
    fetchTags();
  }, []);

  // 編集者情報用状態（ユーザー一覧）
  const [allUsers, setAllUsers] = useState<UserData[]>([]);

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
  // タグを追加する処理
  // ----------------------------
  // 既存タグから選択、または新規作成としてタグを追加する
  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag === "") return;
    if (!selectedTags.includes(trimmedTag)) {
      setSelectedTags([...selectedTags, trimmedTag]);
    }
    setTagSearch("");
  };

  // ----------------------------
  // 選択されたタグを削除する処理
  // ----------------------------
  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  // ----------------------------
  // テキストエディタのカーソル位置にテキストを挿入する処理
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
  // 画像ファイルを読み込み、Base64形式に変換後、Markdown に "/images/xxx" プレースホルダー付き記法を挿入
  const handleUploadImage = () => {
    if (!selectedImageFile) {
      alert("画像ファイルを選択してください。");
      return;
    }
    if (isUploading) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!result || typeof result !== "string" || result.trim() === "") {
        alert("画像の読み込みに失敗しました。ファイルが無効です。");
        setIsUploading(false);
        return;
      }
      // Base64データを取得
      const base64Data = result.trim();
      const id = nanoid(6); // ユニークなID生成
      const placeholder = `/images/${id}`;
      console.log("Debug: Uploaded image placeholder:", placeholder);
      console.log("Debug: Base64 data (先頭50文字):", base64Data.slice(0, 50));

      // Markdown にプレースホルダー付き画像記法を追加
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholder})\n`;
      setMarkdownContent((prev) => prev + imageMarkdown);

      // imageMapping に画像データを登録
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
  // Markdown 内のプレースホルダー画像を GitHub にアップロードし、URL に置換する処理
  // ※最終的な記事データ保存前に実行され、"/images/xxx" プレースホルダーを実際のアップロード先URLに置換します
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    const placeholderRegex = /!\[([^\]]*)\]\((\/images\/([a-zA-Z0-9_-]+))\)/g;
    const uploadPromises: Promise<void>[] = [];
    const placeholderToURL: { [key: string]: string } = {};

    let match: RegExpExecArray | null;
    while ((match = placeholderRegex.exec(markdown)) !== null) {
      const [, , placeholder, id] = match;
      console.log("Debug: Found placeholder in markdown:", placeholder, "with id:", id);
      if (!placeholderToURL[placeholder]) {
        const p = (async () => {
          try {
            const entry = imageMapping[id];
            if (!entry) {
              console.log("Debug: No imageMapping entry for id:", id);
              return;
            }
            const extMatch = entry.filename.match(/\.([a-zA-Z0-9]+)$/);
            const imageType = extMatch && extMatch[1] ? extMatch[1] : "png";
            const original = `data:image/${imageType};base64,`;
            const uploadedUrl = await uploadBase64ImageToGitHub(entry.base64, original);
            console.log("Debug: Uploaded image URL for placeholder", placeholder, "->", uploadedUrl);
            placeholderToURL[placeholder] = uploadedUrl;
          } catch (err) {
            console.error("画像アップロード失敗:", err);
            throw err;
          }
        })();
        uploadPromises.push(p);
      }
    }

    await Promise.all(uploadPromises);
    const replaced = markdown.replace(
      placeholderRegex,
      (m, altText, placeholder, id) => {
        const url = placeholderToURL[placeholder];
        console.log("Debug: Replacing placeholder", placeholder, "with URL:", url);
        return url ? `![${altText}](${url})` : m;
      }
    );
    return replaced;
  };

  // ----------------------------
  // Firestore から GitHub トークンを取得する処理
  // ----------------------------
  async function fetchGithubToken(): Promise<string> {
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

    const imageTypeMatch = originalHead.match(/data:image\/([a-zA-Z]+);base64,/);
    let imageType = "png";
    if (imageTypeMatch && imageTypeMatch[1]) {
      imageType = imageTypeMatch[1];
    }
    const uniqueId = nanoid(10);
    const fileName = `${uniqueId}.${imageType}`;
    const apiUrl = `${GITHUB_API_URL}${fileName}`;

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

    const uploadedUrl = `https://github.com/ASK-STEM-official/Image-Storage/raw/main/static/images/${fileName}`;
    console.log("Debug: GitHub uploaded URL:", uploadedUrl);
    return uploadedUrl;
  };

  // ----------------------------
  // フォーム送信時の処理
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Markdown コンテンツ中の画像プレースホルダーをアップロード後の URL に置換
      let content = markdownContent;
      content = await processMarkdownContent(content);

      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);

      // 選択されたタグをそのまま配列として利用
      const tagsArray = selectedTags;

      await setDoc(docRef, {
        title,
        content,
        tags: tagsArray, // タグフィールドを追加
        created_at: serverTimestamp(),
        authorId: userId,
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((ed) => ed.uid),
        discord: discordFlag, // Discord 紹介用のフラグを保存
      });

      // Firestore に存在しない新規タグがあれば登録する処理
      for (const tag of selectedTags) {
        if (!allTags.includes(tag)) {
          try {
            await setDoc(doc(db, "tags", tag), { name: tag });
          } catch (err) {
            console.error("タグの保存に失敗:", err);
          }
        }
      }

      // ----------------------------
      // ユーザーの経験値とレベルを更新する処理
      // ----------------------------
      // ※記事の最終的な内容（URL置換後の文字数）に応じて xp を加算
      if (userId) {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        let currentXp = 0;
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          currentXp = userData.xp || 0;
        }
        // 文字数に応じた xp 加算（例：最低 xp 10、文字数 ÷ 20 の切り捨て値を xp に加算）
        const xpGain = Math.max(30, Math.floor(content.length / 10));
        const newXp = currentXp + xpGain;
        // レベルは xp が 100 ごとに 1 レベルアップするシンプルな計算式（例：xp 0〜99: レベル1, 100〜199: レベル2, ...）
        const newLevel = Math.floor(newXp / 100) + 1;
        await updateDoc(userDocRef, { xp: newXp, level: newLevel });
        console.log(`Debug: User ${userId} gained ${xpGain} xp, new xp: ${newXp}, new level: ${newLevel}`);
      }

      alert("記事を追加しました！");
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      setSelectedTags([]);
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

        {/* タグ入力（既存タグから選択 or 新規作成） */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">タグを追加</label>
          <input
            type="text"
            placeholder="タグを検索または新規作成"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const trimmed = tagSearch.trim();
                if (trimmed !== "") {
                  handleAddTag(trimmed);
                }
              }
            }}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {tagSearch && (
            <ul className="border border-gray-300 dark:border-gray-600 mt-2 max-h-40 overflow-y-auto">
              {allTags
                .filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()) && !selectedTags.includes(t))
                .map((tag) => (
                  <li
                    key={tag}
                    className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={() => handleAddTag(tag)}
                  >
                    {tag}
                  </li>
                ))}
              {allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                <li
                  className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                  onClick={() => handleAddTag(tagSearch)}
                >
                  新規タグ作成: {tagSearch}
                </li>
              )}
            </ul>
          )}
        </div>

        {/* 選択されたタグの表示 */}
        {selectedTags.length > 0 && (
          <div className="form-group">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">選択されたタグ</label>
            <ul className="space-y-2">
              {selectedTags.map((tag) => (
                <li
                  key={tag}
                  className="flex items-center justify-between px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                >
                  <span className="text-gray-800 dark:text-gray-100">{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Discordチェックボックス */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            Discordに紹介する
            {/* チェックボックスの状態管理：状態変数 discordFlag を利用 */}
            <input
              type="checkbox"
              className="ml-2"
              checked={discordFlag}
              onChange={(e) => setDiscordFlag(e.target.checked)}
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
                  const lowName = (u.displayName || "").toLowerCase();
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
                const lowName = (u.displayName || "").toLowerCase();
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
          <label className="block text-gray-700 dark:text-gray-300 mb-2">内容 (Markdown)</label>
          <div className="flex flex-col md:flex-row gap-4">
            {/* 左側：テキストエディタ＋ツールバー */}
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
                <button type="button" onClick={() => insertAtCursor("[リンク](http://)")} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded">
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
            {/* 右側：リアルタイムプレビュー */}
            <div className="w-full md:w-1/2 overflow-y-auto p-2 border rounded bg-white dark:bg-gray-700 dark:text-white">
              {markdownContent.trim() ? (
                <div
                  className="prose prose-indigo max-w-none dark:prose-dark"
                  key={`${markdownContent}-${JSON.stringify(imageMapping)}`}
                >
                  <ReactMarkdown
                    // remarkPlugins に GFM をサポートするプラグインを追加
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // カスタム画像レンダラー
                      img: ({ node, ...props }) => {
                        if (
                          props.src &&
                          typeof props.src === "string" &&
                          props.src.startsWith("/images/")
                        ) {
                          const id = props.src.replace("/images/", "");
                          const mapped = imageMapping[id];
                          if (mapped && mapped.base64.trim() !== "") {
                            return (
                              <img
                                src={mapped.base64}
                                alt={props.alt || `画像: ${mapped.filename}`}
                                style={{ maxWidth: "100%" }}
                              />
                            );
                          }
                          return <span style={{ color: "red" }}>画像読み込みエラー: {id}</span>;
                        }
                        return <img src={props.src} alt={props.alt || ""} style={{ maxWidth: "100%" }} />;
                      },
                      // コードブロックレンダラー
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeString = Array.isArray(children) ? children[0] : "";
                        return !inline && match ? (
                          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                            {codeString.replace(/\n$/, "")}
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

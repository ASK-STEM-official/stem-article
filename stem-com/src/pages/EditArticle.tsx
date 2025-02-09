// EditArticle.tsx
// このコンポーネントは記事編集用のページを実装しています。
// 指定された記事IDの内容を Firestore から取得し、タイトル、Markdown 形式の本文、編集者の追加・削除、画像アップロード、タグ付け機能を行います。
// 画像アップロード時は、画像ファイルを Base64 形式に変換し、本文中にプレースホルダー（例: /images/xxxxx）を挿入します。
// 記事更新前にプレースホルダーを GitHub 上の画像 URL に置換してから更新を行います。

import React, { useState, useEffect, FormEvent, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc, // ユーザーXP更新用の updateDoc をインポート
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

// 記事の型定義（タグ情報を追加）
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
  tags?: string[]; // タグの配列
}

const EditArticle: React.FC = () => {
  // URLパラメータから記事IDを取得
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ----------------------------
  // 各種状態管理
  // ----------------------------
  // タイトルとMarkdown本文
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  // ユーザー認証情報
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  // 編集者関連の状態
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");

  // タグ関連の状態（Firestore に保存済みのタグ一覧、選択されたタグ、新規入力用）
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");

  // 画像アップロード関連の状態
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  // 画像プレースホルダーと Base64 画像・ファイル名の対応マッピング
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});
  // 連打防止用の状態
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Markdown 入力エリアの参照（カーソル位置制御用）
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const auth = getAuth();

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
  // Firestore から全タグ（"tags" コレクション）を取得する処理
  // ----------------------------
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

  // ----------------------------
  // 編集対象の記事を Firestore から取得する
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
          // タイトルとコンテンツを設定
          setTitle(data.title);
          setMarkdownContent(data.content);
          // タグが設定されていれば初期状態に設定
          if (data.tags && Array.isArray(data.tags)) {
            setSelectedTags(data.tags);
          }
          // 編集者が設定されていれば、各ユーザー情報を取得する
          if (data.editors && Array.isArray(data.editors)) {
            const editorsData: UserData[] = [];
            for (const editorId of data.editors) {
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
          navigate("/");
        }
      } catch (error) {
        console.error("記事の取得に失敗しました:", error);
        navigate("/");
      }
    };
    fetchArticle();
  }, [id, navigate]);

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
  // タグを追加する処理（既存タグから選択 or 新規作成）
  // ----------------------------
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
  // テキストエディタのカーソル位置に文字列を挿入する処理
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
  // 画像アップロードモーダル内での画像読み込み・プレースホルダー挿入処理
  // ----------------------------
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
  // ※更新前に実行し、本文中の "/images/xxx" プレースホルダーを実際のアップロード先 URL に置換します
  // ----------------------------
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
            // 拡張子の取得
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
  // GitHub に Base64 画像をアップロードする処理
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
    // base64Data から "data:image/xxx;base64," を除去
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
  // フォーム送信時の処理（記事更新処理）
  // ----------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let content = markdownContent;
      // Markdown 内の画像プレースホルダーを GitHub 上の URL に置換する
      content = await processMarkdownContent(content);
      if (!id) {
        throw new Error("記事IDが取得できません");
      }
      const docRef = doc(db, "articles", id);
      await setDoc(
        docRef,
        {
          title,
          content,
          created_at: serverTimestamp(),
          authorId: userId,
          authorAvatarUrl: userAvatar,
          editors: selectedEditors.map((ed) => ed.uid),
          tags: selectedTags, // タグ情報を追加
        },
        { merge: true }
      );
      // Firestore に存在しない新規タグがあれば登録する
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
      // XP計算処理（記事更新時にユーザーの xp とレベルを更新）
      // ※最低 xp 10、文字数 ÷ 20 の切り捨て値で加算。必要に応じて加算量を調整してください。
      // ----------------------------
      if (userId) {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        let currentXp = 0;
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          currentXp = userData.xp || 0;
        }
        const xpGain = Math.max(10, Math.floor(content.length / 20));
        const newXp = currentXp + xpGain;
        // xp 100 ごとに 1 レベルアップするシンプルな計算式
        const newLevel = Math.floor(newXp / 100) + 1;
        await updateDoc(userDocRef, { xp: newXp, level: newLevel });
        console.log(`XP更新: +${xpGain} xp, 新しいXP: ${newXp}, 新しいレベル: ${newLevel}`);
      }
      alert("記事を更新しました！");
      navigate("/");
    } catch (err) {
      console.error("エラー:", err);
      alert("記事の更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------
  // コンポーネントの描画
  // ----------------------------
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
                .filter(
                  (t) =>
                    t.toLowerCase().includes(tagSearch.toLowerCase()) &&
                    !selectedTags.includes(t)
                )
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
            {/* 左側：テキストエディタ＋ツールバー */}
            <div className="w-full md:w-1/2">
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
              <textarea
                ref={textareaRef}
                value={markdownContent}
                onChange={(e) => {
                  setMarkdownContent(e.target.value);
                  console.log("Debug: markdownContent changed:", e.target.value);
                }}
                placeholder="ここに Markdown を入力"
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
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // カスタム画像レンダラー：プレースホルダーの場合、imageMapping から Base64 を取得
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

export default EditArticle;

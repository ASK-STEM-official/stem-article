<<<<<<< HEAD
// AddArticle.tsx
// このコンポーネントは記事投稿用ページです。
// タイトル、Markdown形式の本文、編集者の追加、画像アップロード機能、タグ付け機能を実装し、Firestoreに記事を保存します。
=======
// EditArticle.tsx
// この記事編集ページは、指定された記事ID の記事内容を Firestore から取得し、
// タイトル、Markdown 本文、編集者の追加・削除、タグ付け、画像アップロード機能などを実装しています。
// 共通の編集UI部分は ArticleEditor（editor.tsx）を利用して実装しています。
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92

import React, { useState, useEffect, FormEvent } from "react";
// Firebase Firestore 関連のインポート
import {
  doc,
  setDoc,
<<<<<<< HEAD
=======
  updateDoc,
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
  serverTimestamp,
  collection,
  getDocs,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
<<<<<<< HEAD
import { nanoid } from "nanoid"; // ユニークID生成用ライブラリ
import { useNavigate } from "react-router-dom";
// Firebase Authentication 関連のインポート
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
// Markdown のリアルタイムプレビュー用ライブラリ（Editor.tsx 内で利用）
// 共通のエディタコンポーネントのインポート
import Editor from "./Editor.tsx";
import "../AddArticle.css";

// ユーザー情報の型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * AddArticle コンポーネント
 * 記事投稿ページ。タイトル、Markdown 形式の本文、編集者の追加、画像アップロード、タグ付け機能を行い、
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

  // タグ選択用状態
=======
import { nanoid } from "nanoid"; // ユニークID生成用
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import ArticleEditor, { UserData } from "./Editor.tsx"; // 共通エディタコンポーネントの読み込み

// 記事情報の型定義
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
  editors?: string[];
  tags?: string[];
}

// EditArticle コンポーネントは、記事の編集処理を行います。
// URL パラメータから記事IDを取得し、Firestore から記事情報を読み込み、
// ユーザーが記事の内容を編集できるようにします。
// また、タグ・編集者の管理、画像アップロード機能、ユーザー経験値の更新なども実装しています。
const EditArticle: React.FC = () => {
  // URL パラメータから記事IDを取得
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = getAuth();

  // 各種状態管理
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");

<<<<<<< HEAD
  // Discord 紹介用の状態
  const [discordFlag, setDiscordFlag] = useState<boolean>(false);

  // 画像のプレースホルダーとBase64データの対応マッピング
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});

  // ユーザー情報状態
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const navigate = useNavigate();
  const auth = getAuth();

  // ----------------------------
=======
  // 画像アップロード関連の状態
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ユーザー認証情報
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Markdown 入力エリア参照
  const textareaRef = useRef<HTMLTextAreaElement>(null);

>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
  // FirebaseAuth のログイン状態監視
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

<<<<<<< HEAD
  // ----------------------------
  // Firestore の users コレクション取得
  // ----------------------------
=======
  // ユーザー一覧の取得
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
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

<<<<<<< HEAD
  // ----------------------------
  // Firestore の tags コレクション取得
  // ----------------------------
=======
  // タグ一覧の取得
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tagsCol = collection(db, "tags");
        const tagsSnapshot = await getDocs(tagsCol);
        const tagsList = tagsSnapshot.docs.map((doc) => doc.data().name as string);
        setAllTags(tagsList);
      } catch (error) {
        console.error("タグの取得に失敗しました:", error);
      }
    };
    fetchTags();
  }, []);

<<<<<<< HEAD
  // ----------------------------
  // 編集者の追加・削除処理
  // ----------------------------
=======
  // 編集対象の記事を Firestore から取得
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
          setTitle(data.title);
          setMarkdownContent(data.content);
          if (data.tags && Array.isArray(data.tags)) {
            setSelectedTags(data.tags);
          }
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

  // タグ追加／削除のハンドラ
  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed === "") return;
    if (!selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
    }
    setTagSearch("");
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  // 編集者追加／削除のハンドラ
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
  const handleAddEditor = (user: UserData) => {
    if (!selectedEditors.some((editor) => editor.uid === user.uid)) {
      setSelectedEditors([...selectedEditors, user]);
    }
    setEditorSearch("");
  };

  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

<<<<<<< HEAD
  // ----------------------------
  // タグの追加・削除処理
  // ----------------------------
  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag === "") return;
    if (!selectedTags.includes(trimmedTag)) {
      setSelectedTags([...selectedTags, trimmedTag]);
    }
    setTagSearch("");
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  /**
   * Markdown本文中の画像プレースホルダーをGitHub上の画像URLに置換する処理
   * @param markdown 入力されたMarkdown本文
   * @returns 置換後のMarkdown本文
   */
  const processMarkdownContent = async (markdown: string): Promise<string> => {
    const placeholderRegex = /!\[([^\]]*)\]\((\/images\/([a-zA-Z0-9_-]+))\)/g;
    const uploadPromises: Promise<void>[] = [];
    const placeholderToURL: { [key: string]: string } = {};

    let match: RegExpExecArray | null;
    while ((match = placeholderRegex.exec(markdown)) !== null) {
      const [, , placeholder, id] = match;
      if (!placeholderToURL[placeholder]) {
        const p = (async () => {
          try {
            const entry = imageMapping[id];
            if (!entry) return;
            const extMatch = entry.filename.match(/\.([a-zA-Z0-9]+)$/);
            const imageType = extMatch && extMatch[1] ? extMatch[1] : "png";
            const original = `data:image/${imageType};base64,`;
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

  /**
   * Firestore から GitHub トークンを取得する処理
   * @returns GitHubトークン文字列
   */
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

  /**
   * GitHub に Base64画像をアップロードする処理
   * @param base64Data Base64形式の画像データ
   * @param originalHead 元のデータヘッダー文字列
   * @returns アップロード後の画像URL
   */
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
    return uploadedUrl;
  };

  /**
   * フォーム送信時の処理（記事投稿）
   */
=======
  // テキストエディタのカーソル位置に文字列を挿入する処理
  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const before = markdownContent.slice(0, selectionStart);
    const after = markdownContent.slice(selectionEnd);
    const updated = before + text + after;
    setMarkdownContent(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = selectionStart + text.length;
        textareaRef.current.selectionEnd = selectionStart + text.length;
      }
    }, 0);
  };

  // 画像アップロード処理
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
      // 画像データを利用する場合は、result.trim() を使用してください
      const id = nanoid(6);
      const placeholder = `/images/${id}`;
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholder})\n`;
      setMarkdownContent((prev) => prev + imageMarkdown);
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

  // 記事更新時の処理
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
<<<<<<< HEAD
      // Markdown本文中の画像プレースホルダーをアップロード後のURLに置換
      let content = markdownContent;
      content = await processMarkdownContent(content);

      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);

      await setDoc(docRef, {
        title,
        content,
        tags: selectedTags,
        created_at: serverTimestamp(),
        authorId: userId,
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((ed) => ed.uid),
        discord: discordFlag,
      });

      // Firestore に存在しない新規タグがあれば登録する処理
=======
      const content = markdownContent; // ※画像プレースホルダーの処理等は必要に応じて追加
      if (!id) throw new Error("記事IDが取得できません");
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
          tags: selectedTags,
        },
        { merge: true }
      );
      // 新規タグの保存
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
      for (const tag of selectedTags) {
        if (!allTags.includes(tag)) {
          try {
            await setDoc(doc(db, "tags", tag), { name: tag });
          } catch (err) {
            console.error("タグの保存に失敗:", err);
          }
        }
      }
<<<<<<< HEAD

      // ユーザーの経験値とレベルを更新する処理
=======
      // XP計算処理（例：最低 xp 10、文字数 ÷ 20 の切り捨て値）
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
      if (userId) {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        let currentXp = 0;
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          currentXp = userData.xp || 0;
        }
        const xpGain = Math.max(30, Math.floor(content.length / 10));
        const newXp = currentXp + xpGain;
        const newLevel = Math.floor(newXp / 100) + 1;
        await updateDoc(userDocRef, { xp: newXp, level: newLevel });
      }

      alert("記事を追加しました！");
      // 入力フォームのリセット
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      setSelectedTags([]);
      navigate("/");
    } catch (err) {
      console.error("エラー:", err);
      alert("記事の投稿に失敗しました。");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
<<<<<<< HEAD
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">記事を追加</h1>
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

        {/* Discordチェックボックス */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            Discordに紹介する
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

        {/* Markdownエディタ部分（共通Editorコンポーネントを使用） */}
        <Editor
          markdownContent={markdownContent}
          setMarkdownContent={setMarkdownContent}
          imageMapping={imageMapping}
          setImageMapping={setImageMapping}
        />

=======
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">記事を編集</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <ArticleEditor
          title={title}
          onTitleChange={(e) => setTitle(e.target.value)}
          tagSearch={tagSearch}
          onTagSearchChange={(e) => setTagSearch(e.target.value)}
          allTags={allTags}
          selectedTags={selectedTags}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          // EditArticle では Discord 紹介は不要のためプロパティは渡さない
          editorSearch={editorSearch}
          onEditorSearchChange={(e) => setEditorSearch(e.target.value)}
          allUsers={allUsers}
          selectedEditors={selectedEditors}
          onAddEditor={handleAddEditor}
          onRemoveEditor={handleRemoveEditor}
          markdownContent={markdownContent}
          onMarkdownContentChange={(e) => setMarkdownContent(e.target.value)}
          onInsertAtCursor={insertAtCursor}
          textareaRef={textareaRef}
          showImageModal={showImageModal}
          setShowImageModal={setShowImageModal}
          selectedImageFile={selectedImageFile}
          onImageFileChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              setSelectedImageFile(e.target.files[0]);
            }
          }}
          isUploading={isUploading}
          handleUploadImage={handleUploadImage}
        />
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
        <button
          type="submit"
          disabled={false}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          投稿
        </button>
      </form>
    </div>
  );
};

export default AddArticle;

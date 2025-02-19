// AddArticle.tsx
<<<<<<< HEAD
// このコンポーネントは記事投稿用ページです。
// タイトル、Markdown形式の本文、編集者の追加、画像アップロード機能、タグ付け機能を実装し、Firestoreに記事を保存します。

import React, { useState, useEffect, FormEvent } from "react";
// Firebase Firestore 関連のインポート
=======
// この記事コンテナは、記事投稿用のページです。
// ユーザー認証、タグ・編集者の取得、画像アップロード、経験値更新などのロジックを持ち、
// 共通の編集UI部分は ArticleEditor（editor.tsx）を利用して実装しています。

import React, { useState, useEffect, FormEvent, useRef } from "react";
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid"; // ユニークID生成用
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
<<<<<<< HEAD
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
=======
import ArticleEditor, { UserData } from "./Editor.tsx"; // 共通エディタコンポーネントの読み込み

// この関数コンポーネントは、記事投稿ページのロジックを担当しています。
// ユーザー認証、タグ・編集者の管理、画像アップロード、記事の保存やユーザー経験値の更新などを行います。
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
const AddArticle: React.FC = () => {
  // 各種状態管理
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
<<<<<<< HEAD

  // 編集者選択用状態
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");

  // タグ選択用状態
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");

  // Discord 紹介用の状態
  const [discordFlag, setDiscordFlag] = useState<boolean>(false);

  // 画像のプレースホルダーとBase64データの対応マッピング
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});

  // ユーザー情報状態
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
=======
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");
  const [discordFlag, setDiscordFlag] = useState<boolean>(false);

  // 画像アップロード関連の状態
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  // ※画像マッピングなどの詳細処理は必要に応じて追加してください
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ユーザー認証情報
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const navigate = useNavigate();
  const auth = getAuth();

<<<<<<< HEAD
  // ----------------------------
=======
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

  // ユーザー一覧の取得
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
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Markdown本文中の画像プレースホルダーをアップロード後のURLに置換
      let content = markdownContent;
      content = await processMarkdownContent(content);

      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);

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

  // 画像アップロード処理（画像ファイルを Base64 変換して Markdown にプレースホルダーを追加）
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
      // 画像データを利用する場合は、以下のように result.trim() の結果を使用してください
      // 例: const base64Data = result.trim();
      const id = nanoid(6);
      const placeholder = `/images/${id}`;
      // 画像用の Markdown 記法を本文に追加
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholder})\n`;
      setMarkdownContent((prev) => prev + imageMarkdown);
      // ※画像データの保存処理（imageMapping など）は必要に応じて追加してください
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

  // 記事投稿時の処理
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Markdown 内の画像プレースホルダーの処理などを行った後（ここでは省略）
      const content = markdownContent; // ※必要に応じて画像URLの置換処理を追加
      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
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
      // 新規タグの保存処理
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
      // ユーザーの経験値とレベル更新処理（例：最低 xp 30、文字数 ÷ 10 の切り捨て値を xp に加算）
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
<<<<<<< HEAD
=======
        console.log(`XP更新: +${xpGain} xp, 新しいXP: ${newXp}, 新しいレベル: ${newLevel}`);
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
      }
      alert("記事を追加しました！");
<<<<<<< HEAD
      // 入力フォームのリセット
=======
      // 各状態のリセット
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
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
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">記事を追加</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
<<<<<<< HEAD
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
        <ArticleEditor
          title={title}
          onTitleChange={(e) => setTitle(e.target.value)}
          tagSearch={tagSearch}
          onTagSearchChange={(e) => setTagSearch(e.target.value)}
          allTags={allTags}
          selectedTags={selectedTags}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          discordFlag={discordFlag}
          onDiscordFlagChange={(e) => setDiscordFlag(e.target.checked)}
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

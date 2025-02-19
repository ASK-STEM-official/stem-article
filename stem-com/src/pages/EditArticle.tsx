// EditArticle.tsx
// このコンポーネントは記事編集用のページです。
// 指定された記事IDの内容をFirestoreから取得し、タイトル、Markdown形式の本文、
// 編集者の追加・削除、画像アップロード、タグ付け機能を提供します。
// 更新前にMarkdown内の画像プレースホルダーをGitHub上の画像URLに置換してから更新を行います。

import React, { useState, useEffect, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid"; // ユニークID生成用ライブラリ
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
// 共通のエディタコンポーネントのインポート
import Editor from "./Editor.tsx";

// ユーザー情報の型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

// 記事の型定義（タグ情報等を含む）
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

/**
 * EditArticle コンポーネント
 * 記事編集ページ。指定された記事IDの内容をFirestoreから取得し、タイトル、Markdown形式の本文、
 * 編集者の追加・削除、画像アップロード、タグ付け機能を提供します。
 * 更新前にMarkdown内の画像プレースホルダーをGitHub上の画像URLに置換してから更新します。
 */
const EditArticle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ----------------------------
  // 各種状態管理
  // ----------------------------
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");

  // ユーザー認証情報
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // 編集者関連の状態
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");

  // タグ関連の状態
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");

  // 画像のプレースホルダーとBase64データの対応マッピング
  const [imageMapping, setImageMapping] = useState<{
    [key: string]: { base64: string; filename: string };
  }>({});

  // 連打防止用の状態
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
  // Firestore の users コレクションから全ユーザー取得
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
  // Firestore の tags コレクションから全タグ取得
  // ----------------------------
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const tagsCol = collection(db, "tags");
        const tagsSnapshot = await getDocs(tagsCol);
        const tagsList = tagsSnapshot.docs.map((doc) => doc.data().name as string);
        setAllTags(tagsList);
      } catch (error) {
        console.error("タグの取得に失敗:", error);
      }
    };
    fetchTags();
  }, []);

  // ----------------------------
  // 編集対象の記事をFirestoreから取得
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

  // ----------------------------
  // 編集者の追加・削除処理
  // ----------------------------
  const handleAddEditor = (user: UserData) => {
    if (!selectedEditors.some((editor) => editor.uid === user.uid)) {
      setSelectedEditors([...selectedEditors, user]);
    }
    setEditorSearch("");
  };

  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

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
   * FirestoreからGitHubトークンを取得する処理
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
      console.error("GitHubトークンのドキュメントが見つかりません");
      return "";
    } catch (err) {
      console.error("GitHubトークン取得エラー:", err);
      return "";
    }
  }

  /**
   * GitHubにBase64画像をアップロードする処理
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
   * フォーム送信時の処理（記事更新）
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let content = markdownContent;
      // Markdown本文中の画像プレースホルダーをGitHub上の画像URLに置換
      content = await processMarkdownContent(content);
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
      // Firestoreに存在しない新規タグがあれば登録
      for (const tag of selectedTags) {
        if (!allTags.includes(tag)) {
          try {
            await setDoc(doc(db, "tags", tag), { name: tag });
          } catch (err) {
            console.error("タグの保存に失敗:", err);
          }
        }
      }
      // ユーザーの経験値とレベル更新処理
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
        const newLevel = Math.floor(newXp / 100) + 1;
        await updateDoc(userDocRef, { xp: newXp, level: newLevel });
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

  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">記事を編集</h1>
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

        {/* Markdownエディタ部分（共通Editorコンポーネントを使用） */}
        <Editor
          markdownContent={markdownContent}
          setMarkdownContent={setMarkdownContent}
          imageMapping={imageMapping}
          setImageMapping={setImageMapping}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          更新
        </button>
      </form>
    </div>
  );
};

export default EditArticle;

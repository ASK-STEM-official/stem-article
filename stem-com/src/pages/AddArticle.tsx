import React, { useState, useEffect, FormEvent } from "react";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { nanoid } from "nanoid";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import Editor from "./Editor.tsx";

// ユーザー情報の型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

const AddArticle: React.FC = () => {
  // 記事タイトル・本文
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");

  // 編集者選択用
  const [selectedEditors, setSelectedEditors] = useState<UserData[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");

  // 画像アップロード用
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageMapping, setImageMapping] = useState<{ [key: string]: { base64: string; filename: string } }>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ユーザー認証情報
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // タグ用
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");

  // Discordフラグ
  const [discordFlag, setDiscordFlag] = useState<boolean>(false);

  // 編集者候補（全ユーザー）
  const [allUsers, setAllUsers] = useState<UserData[]>([]);

  // シリーズ関連
  const [seriesId, setSeriesId] = useState<string>(""); // 選択中のシリーズID（未選択時は空文字）
  const [allSeries, setAllSeries] = useState<{ id: string; title: string }[]>([]);
  const [newSeriesTitle, setNewSeriesTitle] = useState<string>("");
  const [seriesOrder, setSeriesOrder] = useState<number>(1);

  const navigate = useNavigate();
  const auth = getAuth();

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

  // Firestore の users コレクション取得
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

  // Firestore の tags コレクション取得
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

  // Firestore の series コレクション取得（リアルタイム更新）
  useEffect(() => {
    const seriesCol = collection(db, "series");
    const unsubscribe = onSnapshot(seriesCol, (snapshot) => {
      const seriesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
      }));
      setAllSeries(seriesList);
    });
    return () => unsubscribe();
  }, []);

  // 編集者追加／削除処理
  const handleAddEditor = (user: UserData) => {
    if (!selectedEditors.some((editor) => editor.uid === user.uid)) {
      setSelectedEditors([...selectedEditors, user]);
    }
    setEditorSearch("");
  };

  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

  // タグ追加／削除処理
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
      const base64Data = result.trim();
      const id = nanoid(6);
      const placeholder = `/images/${id}`;
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholder})\n`;
      setMarkdownContent((prev) => prev + imageMarkdown);
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

  // Markdown内の画像プレースホルダーをGitHub上の画像URLに置換
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
    const replaced = markdown.replace(placeholderRegex, (m, altText, placeholder) => {
      const url = placeholderToURL[placeholder];
      return url ? `![${altText}](${url})` : m;
    });
    return replaced;
  };

  // FirestoreからGitHubトークン取得
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

  // GitHubに画像アップロード
  const uploadBase64ImageToGitHub = async (base64Data: string, originalHead: string): Promise<string> => {
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

  // 新規シリーズ作成
  const createNewSeries = async () => {
    if (!newSeriesTitle.trim()) return;
    const newSeriesId = nanoid(10);
    await setDoc(doc(db, "series", newSeriesId), {
      title: newSeriesTitle,
      created_at: serverTimestamp(),
      articles: [],
    });
    // onSnapshot でリアルタイム更新されるため、ローカル状態の更新は不要
    setSeriesId(newSeriesId);
    setNewSeriesTitle("");
    alert("新しいシリーズを作成しました！");
  };

  // フォーム送信処理（記事投稿）
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Markdown内の画像プレースホルダーをGitHub上の画像URLに置換
      let content = await processMarkdownContent(markdownContent);

      // 新規記事ID生成
      const articleId = nanoid(10);
      const docRef = doc(db, "articles", articleId);

      // 記事データ作成（シリーズ情報は含まず、後からシリーズ更新）
      const articleData = {
        title,
        content,
        tags: selectedTags,
        created_at: serverTimestamp(),
        authorId: userId,
        authorAvatarUrl: userAvatar,
        editors: selectedEditors.map((ed) => ed.uid),
        discord: discordFlag,
      };

      // 記事をarticlesコレクションに保存
      await setDoc(docRef, articleData);

      // シリーズが選択されている場合は、シリーズドキュメントのarticles配列に記事情報を追加
      if (seriesId) {
        const seriesRef = doc(db, "series", seriesId);
        await updateDoc(seriesRef, {
          articles: arrayUnion({
            articleId,
            order: seriesOrder,
            title,
          }),
        });
      }

      // 新規タグ登録（Firestoreに存在しないタグを追加）
      for (const tag of selectedTags) {
        if (!allTags.includes(tag)) {
          try {
            await setDoc(doc(db, "tags", tag), { name: tag });
          } catch (err) {
            console.error("タグの保存に失敗:", err);
          }
        }
      }

      // ユーザーXP更新処理
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
      // 入力フォームリセット
      setTitle("");
      setMarkdownContent("");
      setSelectedEditors([]);
      setSelectedTags([]);
      setSeriesId("");
      setSeriesOrder(1);
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

        {/* シリーズ選択 */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">シリーズを選択</label>
          <select
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="">シリーズなし</option>
            {allSeries.map((series) => (
              <option key={series.id} value={series.id}>
                {series.title}
              </option>
            ))}
          </select>
        </div>

        {/* 新規シリーズ作成 */}
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">新しいシリーズを作成</label>
          <input
            type="text"
            value={newSeriesTitle}
            onChange={(e) => setNewSeriesTitle(e.target.value)}
            placeholder="シリーズ名を入力"
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
          />
          <button
            type="button"
            onClick={createNewSeries}
            className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            新規シリーズ作成
          </button>
        </div>

        {/* シリーズ内の順序指定（シリーズ選択時のみ表示） */}
        {seriesId && (
          <div className="form-group">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">シリーズ内の順序</label>
            <input
              type="number"
              min="1"
              value={seriesOrder}
              onChange={(e) => setSeriesOrder(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
        )}

        {/* タグ入力 */}
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

        {/* 選択されたタグ表示 */}
        {selectedTags.length > 0 && (
          <div className="form-group">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">選択されたタグ</label>
            <ul className="space-y-2">
              {selectedTags.map((tag) => (
                <li key={tag} className="flex items-center justify-between px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600">
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
                      <span className="text-gray-800 dark:text-gray-100">{user.displayName}</span>
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

        {/* 選択された編集者表示 */}
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

        {/* Markdownエディタ（共通Editorコンポーネントを使用） */}
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
          投稿
        </button>
      </form>

      {/* 画像アップロードモーダル */}
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

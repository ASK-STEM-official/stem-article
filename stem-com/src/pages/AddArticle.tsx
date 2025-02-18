// AddArticle.tsx
// この記事コンテナは、記事投稿用のページです。
// ユーザー認証、タグ・編集者の取得、画像アップロード、経験値更新などのロジックを持ち、
// 共通の編集UI部分は ArticleEditor（editor.tsx）を利用して実装しています。

import React, { useState, useEffect, FormEvent, useRef } from "react";
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
import ArticleEditor, { UserData } from "./Editor.tsx"; // 共通エディタコンポーネントの読み込み

// この関数コンポーネントは、記事投稿ページのロジックを担当しています。
// ユーザー認証、タグ・編集者の管理、画像アップロード、記事の保存やユーザー経験値の更新などを行います。
const AddArticle: React.FC = () => {
  // 各種状態管理
  const [title, setTitle] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>("");
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
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const navigate = useNavigate();
  const auth = getAuth();

  // Markdown 入力エリア参照
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // タグ一覧の取得
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
  const handleAddEditor = (user: UserData) => {
    if (!selectedEditors.some((editor) => editor.uid === user.uid)) {
      setSelectedEditors([...selectedEditors, user]);
    }
    setEditorSearch("");
  };

  const handleRemoveEditor = (uid: string) => {
    setSelectedEditors(selectedEditors.filter((editor) => editor.uid !== uid));
  };

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
      // ユーザーの経験値とレベル更新処理（例：最低 xp 30、文字数 ÷ 10 の切り捨て値を xp に加算）
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
        console.log(`XP更新: +${xpGain} xp, 新しいXP: ${newXp}, 新しいレベル: ${newLevel}`);
      }
      alert("記事を追加しました！");
      // 各状態のリセット
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
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          投稿
        </button>
      </form>
    </div>
  );
};

export default AddArticle;

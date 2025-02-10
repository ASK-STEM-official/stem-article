// EditArticle.tsx
// この記事編集ページは、指定された記事ID の記事内容を Firestore から取得し、
// タイトル、Markdown 本文、編集者の追加・削除、タグ付け、画像アップロード機能などを実装しています。
// 共通の編集UI部分は ArticleEditor（editor.tsx）を利用して実装しています。

import React, { useState, useEffect, FormEvent, useRef } from "react";
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
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");

  // 画像アップロード関連
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ユーザー認証情報
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

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
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
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
      for (const tag of selectedTags) {
        if (!allTags.includes(tag)) {
          try {
            await setDoc(doc(db, "tags", tag), { name: tag });
          } catch (err) {
            console.error("タグの保存に失敗:", err);
          }
        }
      }
      // XP計算処理（例：最低 xp 10、文字数 ÷ 20 の切り捨て値）
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

  return (
    <div className="max-w-2xl mx-auto p-4 bg-lightBackground dark:bg-darkBackground min-h-screen">
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

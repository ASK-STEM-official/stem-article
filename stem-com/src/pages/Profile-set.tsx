// src/pages/Profile.tsx
import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { useNavigate } from "react-router-dom";

/**
 * ユーザーのプロフィール情報を表現するインターフェース
 * displayName: ユーザーの表示名
 * bio: 自己紹介文
 * avatarUrl: プロフィール画像のURL
 */
interface UserProfile {
  displayName: string;
  bio: string;
  avatarUrl: string;
}

/**
 * Profileコンポーネント
 * Firebase Authenticationでログインしているユーザーのプロフィール情報を読み込み・編集・保存する
 * @returns ユーザープロフィール画面
 */
const Profile: React.FC = () => {
  // ユーザープロフィールを保持する状態
  const [profile, setProfile] = useState<UserProfile>({
    displayName: "",
    bio: "",
    avatarUrl: "",
  });

  // ローディング状態を表すフラグ
  const [loading, setLoading] = useState<boolean>(true);

  // Firebase Authentication のインスタンス
  const auth = getAuth();

  // 画面遷移に使用
  const navigate = useNavigate();

  /**
   * コンポーネントマウント時にユーザーのログイン状態を監視し、
   * ログインしていればFirestoreからプロフィール情報を取得する
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // Firestoreの"users"コレクションからユーザーのドキュメントを取得
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          // 既存のプロフィール情報があればそれをStateにセット
          setProfile(userDoc.data() as UserProfile);
        } else {
          // プロフィール情報がなければ初期データを登録
          const initialProfile: UserProfile = {
            displayName: user.displayName || user.email || "ユーザー",
            bio: "",
            avatarUrl: user.photoURL || "",
          };
          await setDoc(userDocRef, initialProfile);
          setProfile(initialProfile);
        }
      } else {
        // 未ログインの場合はログイン画面へ遷移
        navigate("/login");
      }
      // ローディング完了
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  /**
   * 入力フィールド変更時にStateを更新
   * @param e イベントオブジェクト
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * フォーム送信時にFirestoreへデータを保存
   * @param e イベントオブジェクト
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const userDocRef = doc(db, "users", auth.currentUser?.uid || "");
      await setDoc(
        userDocRef,
        {
          displayName: profile.displayName,
          bio: profile.bio,
        },
        { merge: true }
      );

      alert("プロフィールを更新しました！");
    } catch (error) {
      console.error("プロフィール更新エラー:", error);
      alert("プロフィールの更新に失敗しました。");
    }
  };

  // ローディング中に表示する部分
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        読み込み中...
      </div>
    );
  }

  return (
    <div
      // ダークテーマにも対応したコンテナ
      // text-gray-700 と dark:text-gray-200 で文字色を切り替え
      className="max-w-md mx-auto p-4 text-gray-700 dark:text-gray-200"
    >
      <h1 className="text-2xl font-bold mb-4">プロフィール</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 flex flex-col items-center">
          {profile.avatarUrl ? (
            // プロフィール画像が設定されている場合は表示
            <img
              src={profile.avatarUrl}
              alt="プロフィール"
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
          ) : (
            // 画像がない場合はダミーの丸を表示
            <div className="w-24 h-24 rounded-full bg-gray-300 dark:bg-gray-600 mb-2" />
          )}
        </div>
        <div className="mb-4">
          {/* ラベルもダークテーマで文字色を切り替え */}
          <label htmlFor="displayName" className="block text-gray-700 dark:text-gray-300">
            表示名
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={profile.displayName}
            onChange={handleChange}
            // ダークテーマで背景と文字色を切り替え
            // border もダークモードでやや暗いグレーに
            className="w-full px-3 py-2 border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="bio" className="block text-gray-700 dark:text-gray-300">
            自己紹介
          </label>
          <textarea
            id="bio"
            name="bio"
            value={profile.bio}
            onChange={handleChange}
            rows={4}
            // テキストエリアもダークテーマ対応
            className="w-full px-3 py-2 border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white"
          />
        </div>
        <button
          type="submit"
          // ボタンはダークテーマ対応するかどうか好みで
          // ここでは背景の色を固定
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition-colors"
        >
          更新
        </button>
      </form>
    </div>
  );
};

export default Profile;

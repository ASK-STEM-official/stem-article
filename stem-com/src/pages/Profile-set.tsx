// src/pages/Profile.tsx
// このコンポーネントは、Firebase Authentication でログインしているユーザーのプロフィール情報（表示名、自己紹介、プロフィール画像URL）を
// Firestore から取得し、画面上で表示・編集・保存するためのものです。

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { useNavigate } from "react-router-dom";

// ユーザーのプロフィール情報を表現するインターフェース
// displayName: ユーザーの表示名、bio: 自己紹介文、avatarUrl: プロフィール画像のURLを保持します。
interface UserProfile {
  displayName: string;
  bio: string;
  avatarUrl: string;
}

/**
 * Profile コンポーネント
 * Firebase Authentication によりログインしているユーザーのプロフィール情報を
 * Firestore から取得し、編集・保存するためのコンポーネントです。
 */
const Profile: React.FC = () => {
  // ユーザーのプロフィール情報を状態として管理します。
  const [profile, setProfile] = useState<UserProfile>({
    displayName: "",
    bio: "",
    avatarUrl: "",
  });

  // データの読み込み中かどうかの状態を管理するフラグ
  const [loading, setLoading] = useState<boolean>(true);

  // Firebase Authentication のインスタンスを取得
  const auth = getAuth();

  // 画面遷移を行うための React Router のフック
  const navigate = useNavigate();

  /**
   * コンポーネントのマウント時に実行される処理
   * onAuthStateChanged を使用して、ユーザーのログイン状態を監視し、ログイン中の場合は Firestore から
   * ユーザーのプロフィール情報を取得します。未ログインの場合はログイン画面へ遷移します。
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // ログインしている場合は Firestore の "users" コレクションからユーザーのドキュメントを取得
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          // 既にプロフィール情報が存在する場合、そのデータを状態にセット
          setProfile(userDoc.data() as UserProfile);
        } else {
          // プロフィール情報が存在しない場合は、初期データを作成して Firestore に保存し、状態にセット
          const initialProfile: UserProfile = {
            displayName: user.displayName || user.email || "ユーザー",
            bio: "",
            avatarUrl: user.photoURL || "",
          };
          await setDoc(userDocRef, initialProfile);
          setProfile(initialProfile);
        }
      } else {
        // ログインしていない場合は、ログイン画面へ遷移
        navigate("/login");
      }
      // 読み込み完了後、ローディング状態を false に変更
      setLoading(false);
    });

    // コンポーネントのアンマウント時に監視を解除
    return () => unsubscribe();
  }, [auth, navigate]);

  /**
   * 入力フィールドの変更イベントを処理する関数
   * 入力内容が変化するたびに、該当するフィールドの値を profile 状態に反映させます。
   * @param e 入力イベントオブジェクト
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * フォーム送信時に呼び出される関数
   * 編集されたプロフィール情報（表示名と自己紹介）を Firestore に保存します。
   * @param e フォーム送信イベントオブジェクト
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // 現在のユーザーの Firestore ドキュメント参照を取得
      const userDocRef = doc(db, "users", auth.currentUser?.uid || "");
      // Firestore にプロフィール情報をマージ更新
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

  // 読み込み中の場合、画面中央に「読み込み中...」と表示
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        読み込み中...
      </div>
    );
  }

  // 読み込み完了後、プロフィール情報の表示・編集フォームをレンダリング
  return (
    <div
      // ダークテーマにも対応したコンテナ
      // text-gray-700 と dark:text-gray-200 で文字色が切り替わります
      className="max-w-md mx-auto p-4 text-gray-700 dark:text-gray-200"
    >
      <h1 className="text-2xl font-bold mb-4">プロフィール</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 flex flex-col items-center">
          {profile.avatarUrl ? (
            // プロフィール画像が設定されている場合は画像を表示
            <img
              src={profile.avatarUrl}
              alt="プロフィール"
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
          ) : (
            // プロフィール画像がない場合は、ダミーの丸い背景を表示
            <div className="w-24 h-24 rounded-full bg-gray-300 dark:bg-gray-600 mb-2" />
          )}
        </div>
        <div className="mb-4">
          <label htmlFor="displayName" className="block text-gray-700 dark:text-gray-300">
            表示名
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={profile.displayName}
            onChange={handleChange}
            // 入力フィールドはダークテーマに対応しており、背景色や文字色、境界線の色が切り替わります
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
            // テキストエリアもダークテーマ対応。背景や文字色が環境に合わせて切り替わります
            className="w-full px-3 py-2 border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white"
          />
        </div>
        <button
          type="submit"
          // ボタンは固定の背景色を使用し、ホバー時に色が変化するスタイルです
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition-colors"
        >
          更新
        </button>
      </form>
    </div>
  );
};

export default Profile;

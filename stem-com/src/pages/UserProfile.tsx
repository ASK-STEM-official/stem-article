// src/pages/UserProfile.tsx
// このコンポーネントはユーザープロフィールページを表示します。
// ユーザー情報（表示名、アバター、自己紹介、アカウント作成日）に加え、
// 経験値 (xp) とレベル、そして経験値バーを表示し、ライト/ダークテーマに対応させています。

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../lib/firebase/db.ts";
import { User } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// ユーザープロフィールの型定義
interface UserProfileData {
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  createdAt?: { seconds: number };
  xp?: number;      // 経験値
  level?: number;   // レベル
}

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCurrentUser, setIsCurrentUser] = useState<boolean>(false); // 自分のプロフィールかどうかの判定
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!id) {
        navigate("/");
        return;
      }

      try {
        // 現在ログイン中のユーザーと表示対象のユーザーが一致するかチェック
        const user = auth.currentUser;
        if (user && user.uid === id) {
          setIsCurrentUser(true);
        } else {
          setIsCurrentUser(false);
        }

        // Firestore からユーザードキュメントを取得
        const userDocRef = doc(db, "users", id);
        const userDocSnap = await getDoc(userDocRef);
        console.log(
          "Fetched User:",
          userDocSnap.exists() ? userDocSnap.data() : "No User Found"
        );

        if (userDocSnap.exists()) {
          setUserData(userDocSnap.data() as UserProfileData);
        } else {
          setUserData(null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id, navigate, auth]);

  // プロフィール編集画面へ遷移する処理
  const redirectToEditProfile = () => {
    navigate("/profileset");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600">ユーザーが見つかりません。</p>
      </div>
    );
  }

  // 経験値とレベルのデフォルト値（未設定の場合）
  const xp = userData.xp || 0;
  const level = userData.level || 1;
  // 次のレベルまでの必要 xp は 100 とし、進捗率は xp の 100 に対する割合（％）で計算
  const progressPercent = Math.min((xp % 100), 100);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden dark:bg-gray-800 p-8">
        <div className="flex items-center space-x-4 mb-6">
          {userData.avatarUrl ? (
            <img
              src={userData.avatarUrl}
              alt={`${userData.displayName}のアバター`}
              className="h-16 w-16 rounded-full"
            />
          ) : (
            <User className="h-16 w-16 text-gray-500" />
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {userData.displayName}
              </h1>
              {isCurrentUser && (
                <button
                  type="button"
                  onClick={redirectToEditProfile}
                  className="text-indigo-600 hover:underline"
                  title="プロフィール編集"
                >
                  🖊
                </button>
              )}
            </div>
            {userData.createdAt && (
              <p className="text-gray-500 dark:text-gray-400">
                アカウント作成日:{" "}
                {format(new Date(userData.createdAt.seconds * 1000), "PPP", {
                  locale: ja,
                })}
              </p>
            )}
          </div>
        </div>

        {/* 経験値・レベル表示セクション */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              レベル: {level}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {xp % 100} / 100 XP
            </span>
          </div>
          <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-3 mt-1">
            <div
              className={`bg-indigo-600 h-3 rounded-full progress-bar`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {userData.bio && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              自己紹介
            </h2>
            <p className="text-gray-700 dark:text-gray-300">{userData.bio}</p>
          </div>
        )}

        {/* 表示したいその他の情報があればここに追加 */}
      </div>
    </div>
  );
};

export default UserProfile;

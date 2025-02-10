// src/pages/Ranking.tsx
// このコンポーネントは、Firestore の "users" コレクションから各ユーザーのレベル・経験値情報を取得し、
// レベルと経験値の降順でランキング表示を行います。
// ※ Firestore で複合クエリ（orderBy("level", "desc") と orderBy("xp", "desc")）を実行するためには
//     対応するインデックスが必要です。
//     エラーメッセージに記載されたリンクからインデックスを作成してください。

import React, { useState, useEffect } from "react";
// Firestore 関連のインポート：users コレクションからドキュメントを取得するため
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
// アバターがない場合に表示するアイコン用
import { User } from "lucide-react";

// ユーザーランキング情報の型定義
interface UserRankingData {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  xp?: number;    // 経験値（未設定の場合は 0 として扱う）
  level?: number; // レベル（未設定の場合は 1 として扱う）
}

/**
 * Ranking コンポーネント
 * Firestore の "users" コレクションからユーザー情報を取得し、レベルと経験値順にランキング表示を行います。
 */
const Ranking: React.FC = () => {
  // ランキング情報を保持する状態
  const [ranking, setRanking] = useState<UserRankingData[]>([]);
  // データ取得中のローディング状態
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        // Firestore の "users" コレクションからデータを取得
        const usersCollection = collection(db, "users");
        // 複合クエリ：level と xp の降順でソート
        // ※このクエリを実行するためには、Firestore コンソールで以下のような複合インデックスが必要です。
        //     [level: desc, xp: desc]
        // エラーメッセージに記載されたリンクからインデックスを作成してください。
        const q = query(
          usersCollection,
          orderBy("level", "desc"),
          orderBy("xp", "desc")
        );
        const querySnapshot = await getDocs(q);
        const users: UserRankingData[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          users.push({
            uid: docSnap.id,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
            xp: data.xp || 0,
            level: data.level || 1,
          });
        });
        setRanking(users);
      } catch (error) {
        console.error("ランキングデータの取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6 text-center">
        ユーザーレベルランキング
      </h1>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                順位
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                アバター
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                名前
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                レベル
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                経験値
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {ranking.map((user, index) => (
              <tr key={user.uid}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                  {index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <User className="h-10 w-10 text-gray-500 dark:text-gray-300" />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                  {user.displayName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                  {user.level}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                  {user.xp || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Ranking;

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query, where, documentId, CollectionReference } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { Calendar, User, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Article } from "../types/Article";
import Editors from "../components/Editors.tsx";

// シリーズ用の型定義
interface Series {
  id: string;
  title: string;
  created_at?: { seconds: number; nanoseconds: number };
  articles?: any[];
  // 他に必要なプロパティがあれば追加してください
}

const ArticleList: React.FC = () => {
  // 記事関連の状態
  const [articles, setArticles] = useState<Article[]>([]);
  const [users, setUsers] = useState<{ [key: string]: { displayName: string; avatarUrl?: string } }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 追加：シリーズ関連の状態
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [seriesSearchQuery, setSeriesSearchQuery] = useState<string>("");

  // Firestore から記事とユーザー情報を取得
  useEffect(() => {
    const fetchArticlesAndUsers = async () => {
      try {
        const articlesQuery = query(collection(db, "articles"), orderBy("created_at", "desc"));
        const articlesSnapshot = await getDocs(articlesQuery);
        const articlesList: Article[] = articlesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Article, "id">),
        }));
        setArticles(articlesList);
        console.log("Fetched Articles:", articlesList);

        const authorIds = Array.from(new Set(articlesList.map((article) => article.authorId)));
        const editorIds = Array.from(new Set(articlesList.flatMap((article) => article.editors || [])));
        const allUserIds = Array.from(new Set([...authorIds, ...editorIds]));
        console.log("Unique User IDs:", allUserIds);

        const chunkSize = 10;
        const userChunks: string[][] = [];
        for (let i = 0; i < allUserIds.length; i += chunkSize) {
          userChunks.push(allUserIds.slice(i, i + chunkSize));
        }
        console.log("User Chunks:", userChunks);

        const usersMap: { [key: string]: { displayName: string; avatarUrl?: string } } = {};
        for (const chunk of userChunks) {
          const usersQuery = query(
            collection(db, "users"),
            where(documentId(), "in", chunk)
          );
          const usersSnapshot = await getDocs(usersQuery);
          console.log(`Fetched Users for Chunk ${chunk}:`, usersSnapshot.docs.map((doc) => doc.id));
          usersSnapshot.docs.forEach((userDoc) => {
            const data = userDoc.data();
            usersMap[userDoc.id] = {
              displayName: data.displayName || "ユーザー",
              avatarUrl: data.avatarUrl || undefined,
            };
          });
        }
        console.log("Users Map:", usersMap);

        allUserIds.forEach((uid) => {
          if (!usersMap[uid]) {
            usersMap[uid] = {
              displayName: "ユーザー",
              avatarUrl: undefined,
            };
          }
        });
        setUsers(usersMap);
      } catch (error) {
        console.error("Error fetching articles or users:", error);
        setError("記事の取得に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setLoading(false);
      }
    };
    fetchArticlesAndUsers();
  }, []);

  // 追加：Firestore からシリーズを取得
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        // ジェネリクスを使って Series 型を指定
        const seriesCol = collection(db, "series") as CollectionReference<Series>;
        const seriesSnapshot = await getDocs(seriesCol);
        const seriesList: Series[] = seriesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Series, "id">),
        }));
        // created_at が存在する場合、降順にソート
        const sortedSeries = seriesList.sort((a, b) => {
          if (a.created_at && b.created_at) {
            return b.created_at.seconds - a.created_at.seconds;
          }
          return 0;
        });
        setAllSeries(sortedSeries);
      } catch (error) {
        console.error("Error fetching series:", error);
      }
    };
    fetchSeries();
  }, []);

  // シリーズ表示：検索クエリがあればフィルタ、なければ最新10件を表示
  const displayedSeries = seriesSearchQuery.trim()
    ? allSeries.filter((series) =>
        series.title.toLowerCase().includes(seriesSearchQuery.toLowerCase())
      )
    : allSeries.slice(0, 10);

  // 記事のフィルタリング
  const filteredArticles = articles.filter((article) => {
    const lowerQuery = searchQuery.toLowerCase();
    const inTitle = article.title.toLowerCase().includes(lowerQuery);
    const inTags = article.tags ? article.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) : false;
    return inTitle || inTags;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-700 dark:text-gray-200">
      {/* 記事検索 */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="タグやタイトルで検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      {/* 追加：シリーズ検索・一覧表示 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">シリーズ</h2>
        <input
          type="text"
          placeholder="シリーズを検索"
          value={seriesSearchQuery}
          onChange={(e) => setSeriesSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        {displayedSeries.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-400 mt-2">該当するシリーズがありません。</p>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mt-4">
            {displayedSeries.map((series) => (
              <Link
                key={series.id}
                to={`/series/${series.id}`}
                className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden dark:bg-gray-800 p-4"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{series.title}</h3>
                {series.created_at && series.created_at.seconds && (
                  <p className="text-sm text-gray-500">
                    {format(new Date(series.created_at.seconds * 1000), "PPP", { locale: ja })}
                  </p>
                )}
                {series.articles && (
                  <p className="text-sm text-gray-500 mt-1">記事数: {series.articles.length}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 記事カードのリスト表示 */}
      {filteredArticles.length === 0 ? (
        <p className="text-center text-gray-600 dark:text-gray-400">
          該当する記事がありません。
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <Link
              key={article.id}
              to={`/articles/${article.id}`}
              className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden dark:bg-gray-800"
            >
              <div className="p-6 flex flex-col h-full">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {article.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4 flex-grow line-clamp-3">
                  {article.content.length > 150
                    ? `${article.content.substring(0, 150)}...`
                    : article.content}
                </p>
                {article.tags && article.tags.length > 0 && (
                  <div className="mb-2">
                    {article.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded mr-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-2">
                    {users[article.authorId]?.avatarUrl ? (
                      <Link to={`/users/${article.authorId}`}>
                        <img
                          src={users[article.authorId].avatarUrl}
                          alt={`${users[article.authorId].displayName}のアバター`}
                          className="h-6 w-6 rounded-full object-cover"
                          loading="lazy"
                        />
                      </Link>
                    ) : (
                      <User className="h-6 w-6 text-gray-400" />
                    )}
                    <span>{users[article.authorId]?.displayName || "ユーザー"}</span>
                    <Editors
                      editors={
                        article.editors
                          ? article.editors.map((uid) => ({
                              uid,
                              displayName: users[uid]?.displayName || "ユーザー",
                              avatarUrl: users[uid]?.avatarUrl,
                            }))
                          : []
                      }
                      showNames={false}
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {article.created_at && article.created_at.seconds
                        ? format(new Date(article.created_at.seconds * 1000), "PPP", { locale: ja })
                        : "不明な日付"}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-indigo-600 font-medium">
                  続きを読む
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArticleList;

import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// シリーズ内の記事情報の型定義
interface SeriesArticle {
  articleId: string;
  order: number;
  title: string;
}

// シリーズの型定義（AddArticle.tsx の記事作成コードでシリーズに保存している構造を参考）
interface Series {
  id: string;
  title: string;
  created_at?: { seconds: number; nanoseconds: number };
  articles?: SeriesArticle[];
}

const SeriesArticles: React.FC = () => {
  // URLパラメータからシリーズIDを取得（例: /series/:id）
  const { id } = useParams<{ id: string }>();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeries = async () => {
      if (!id) {
        setError("シリーズIDが指定されていません。");
        setLoading(false);
        return;
      }
      try {
        const seriesRef = doc(db, "series", id);
        const seriesSnap = await getDoc(seriesRef);
        if (seriesSnap.exists()) {
          const data = seriesSnap.data() as Omit<Series, "id">;
          const seriesData: Series = {
            id: seriesSnap.id,
            ...data,
          };
          // articles 配列が存在する場合、order 順にソート
          if (seriesData.articles) {
            seriesData.articles.sort((a, b) => a.order - b.order);
          }
          setSeries(seriesData);
        } else {
          setError("指定されたシリーズが見つかりません。");
        }
      } catch (err) {
        console.error("シリーズ取得エラー:", err);
        setError("シリーズの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, [id]);

  if (loading) {
    return <div>読み込み中…</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!series) {
    return <div>シリーズの情報がありません。</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{series.title}</h1>
      {series.created_at && (
        <p className="text-gray-500 mb-4">
          作成日:{" "}
          {format(new Date(series.created_at.seconds * 1000), "PPP", { locale: ja })}
        </p>
      )}
      {series.articles && series.articles.length > 0 ? (
        <ul className="space-y-4">
          {series.articles.map((article) => (
            <li key={article.articleId} className="border p-4 rounded flex items-center">
              <span className="font-bold mr-2">{article.order}.</span>
              <Link to={`/articles/${article.articleId}`} className="text-blue-600 hover:underline">
                {article.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>このシリーズには記事がありません。</p>
      )}
    </div>
  );
};

export default SeriesArticles;

// CompositeDocument.tsx
// このコンポーネントは複数の記事を組み合わせて1つのドキュメントとして表示する機能を実装しています。
// Firestoreの"compositeDocuments"コレクションに、対象の記事IDの配列（articleIds）を格納し、
// そのドキュメントを基に複数の記事を連結して表示します。

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkAdmonitions from "remark-admonitions";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Article } from "../types/Article"; // Article型はtagsフィールドなどを含むように定義する
import Editors from "../components/Editors.tsx";

interface CompositeDocumentData {
  title: string;
  articleIds: string[]; // 組み合わせる記事のIDリスト
  created_at: any;
}

const CompositeDocument: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // composite documentのID
  const [compositeDoc, setCompositeDoc] = useState<CompositeDocumentData | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompositeDocument = async () => {
      if (!id) {
        navigate("/");
        return;
      }
      try {
        // compositeDocumentsコレクションからドキュメントを取得
        const docRef = doc(db, "compositeDocuments", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as CompositeDocumentData;
          setCompositeDoc(data);
          // 各記事を取得
          const articlesPromises = data.articleIds.map(async (articleId) => {
            const articleDocRef = doc(db, "articles", articleId);
            const articleSnap = await getDoc(articleDocRef);
            if (articleSnap.exists()) {
              return { id: articleSnap.id, ...(articleSnap.data() as Omit<Article, "id">) } as Article;
            } else {
              return null;
            }
          });
          const articlesData = await Promise.all(articlesPromises);
          setArticles(articlesData.filter(a => a !== null) as Article[]);
        } else {
          console.log("コンポジットドキュメントが存在しません。");
          navigate("/");
        }
      } catch (error) {
        console.error("コンポジットドキュメントの取得に失敗しました:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchCompositeDocument();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!compositeDoc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600 dark:text-gray-400">ドキュメントが見つかりません。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        {compositeDoc.title}
      </h1>
      {articles.map((article) => (
        <div key={article.id} className="mb-8 border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {article.title}
          </h2>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="ml-1">
              {article.created_at && article.created_at.seconds
                ? format(new Date(article.created_at.seconds * 1000), 'PPP', { locale: ja })
                : "不明な日付"}
            </span>
          </div>
          <div className="prose prose-indigo dark:prose-dark">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkAdmonitions]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = Array.isArray(children) ? children[0] : "";
                  return !inline && match ? (
                    <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                      {codeString.replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
          {/* タグの表示 */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-2">
              {article.tags.map((tag, index) => (
                <span key={index} className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded mr-1">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CompositeDocument;

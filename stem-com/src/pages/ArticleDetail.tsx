// src/pages/ArticleDetail.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom"; // Link を追加
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Calendar, User, Edit } from 'lucide-react'; // Edit アイコンを追加
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Article } from '../types/Article'; // 型定義のインポート
import Editors from "../components/Editors.tsx"; // 編集者表示コンポーネントのインポート

// Firebase Authentication
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

// ユーザーの型定義
interface UserData {
  uid: string;
  displayName: string;
  avatarUrl?: string;
}

const ArticleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [author, setAuthor] = useState<UserData | null>(null);
  const [editors, setEditors] = useState<UserData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  // モーダルの状態管理（不要になったため削除）
  // const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // 認証情報
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const auth = getAuth();

  useEffect(() => {
    // 認証状態の監視
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const fetchArticleAndUsers = async () => {
      if (!id) {
        navigate('/');
        return;
      }

      try {
        // 記事を取得
        const docRef = doc(db, "articles", id);
        const docSnap = await getDoc(docRef);
        console.log("Fetched Article:", docSnap.exists() ? docSnap.data() : "No Article Found");

        if (docSnap.exists()) {
          const data = docSnap.data() as Article;
          setArticle({
            id: docSnap.id,
            ...data,
          });
          console.log("Article Data:", data);

          // 著者のデータを取得（authorIdが存在する場合のみ）
          if (data.authorId) {
            const userDocRef = doc(db, "users", data.authorId);
            const userDoc = await getDoc(userDocRef);
            console.log(`Fetched User for authorId ${data.authorId}:`, userDoc.exists() ? userDoc.data() : "No User Found");

            if (userDoc.exists()) {
              const userData = userDoc.data();
              setAuthor({
                uid: userDoc.id,
                displayName: userData.displayName || "ユーザー",
                avatarUrl: userData.avatarUrl || undefined,
              });
            } else {
              setAuthor({
                uid: data.authorId,
                displayName: "ユーザー",
                avatarUrl: undefined,
              });
            }
          } else {
            setAuthor({
              uid: "",
              displayName: "ユーザー",
              avatarUrl: undefined,
            });
          }

          // 編集者のデータを取得（editorsが存在する場合のみ）
          if (data.editors && Array.isArray(data.editors)) {
            const editorsData: UserData[] = [];
            for (const editorId of data.editors) {
              const editorDocRef = doc(db, "users", editorId);
              const editorDoc = await getDoc(editorDocRef);
              console.log(`Fetched User for editorId ${editorId}:`, editorDoc.exists() ? editorDoc.data() : "No User Found");

              if (editorDoc.exists()) {
                const editorData = editorDoc.data();
                editorsData.push({
                  uid: editorDoc.id,
                  displayName: editorData.displayName || "ユーザー",
                  avatarUrl: editorData.avatarUrl || undefined,
                });
              } else {
                editorsData.push({
                  uid: editorId,
                  displayName: "ユーザー",
                  avatarUrl: undefined,
                });
              }
            }
            setEditors(editorsData);
          }
        } else {
          console.log("記事が存在しません。");
          navigate('/');
        }
      } catch (error) {
        console.error("Error fetching article or users:", error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchArticleAndUsers();
  }, [id, navigate, auth]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-center text-gray-600 dark:text-gray-400">記事が見つかりません。</p>
      </div>
    );
  }

  /**
   * 編集可能かどうかを判断する関数
   */
  const canEdit = () => {
    if (!currentUser || !article) return false;
    // 著者が編集可能な場合
    if (currentUser.uid === article.authorId) return true;
    // 編集者に含まれる場合
    return article.editors?.includes(currentUser.uid) || false;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <article className="bg-white rounded-lg shadow-lg overflow-hidden dark:bg-gray-800">
        <div className="p-8">
          <div className="flex justify-between items-start">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {article.title}
            </h1>
            {/* 編集ボタン */}
            {canEdit() && (
              <Link
                to={`/articles/${article.id}/edit`}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center"
                title="編集"
              >
                <Edit className="h-5 w-5 mr-1" />
                編集
              </Link>
            )}
          </div>
          
          {/* 著者情報と作成日（最初の表示）を削除 */}

          {/* 著者と編集者を同じ行に表示 */}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              {/* 著者のアバターと表示名 */}
              {author?.avatarUrl ? (
                <Link to={`/users/${author.uid}`}>
                  <img
                    src={author.avatarUrl}
                    alt={`${author.displayName}のアバター`}
                    className="h-6 w-6 rounded-full object-cover"
                    loading="lazy"
                  />
                </Link>
              ) : (
                <User className="h-6 w-6 text-gray-400" />
              )}
              <span>{author?.displayName || "ユーザー"}</span>

              {/* 編集者のアイコンのみ表示 */}
              <Editors
                editors={editors}
                showNames={false} // 表示名を非表示に設定
              />
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>
                {article.created_at && article.created_at.seconds
                  ? format(new Date(article.created_at.seconds * 1000), 'PPP', { locale: ja })
                  : "不明な日付"}
              </span>
            </div>
          </div>

          {/* コンテンツ */}
          <div className="prose prose-indigo max-w-none dark:prose-dark mt-8">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
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
        </div>
      </article>
    </div>
  );
};

export default ArticleDetail;

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom"; 
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Calendar, User, Edit } from 'lucide-react'; 
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Article } from '../types/Article'; 
import Editors from "../components/Editors.tsx"; // 編集者表示コンポーネントのインポート

// Firebase Authentication
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

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
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const auth = getAuth();

  useEffect(() => {
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
        const docRef = doc(db, "articles", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const { id: _, ...dataWithoutId } = docSnap.data() as Article;
          setArticle({
            id: docSnap.id,
            ...dataWithoutId,
          });

          if (dataWithoutId.authorId) {
            const userDocRef = doc(db, "users", dataWithoutId.authorId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setAuthor({
                uid: userDoc.id,
                displayName: userData.displayName || "ユーザー",
                avatarUrl: userData.avatarUrl || undefined,
              });
            }
          }

          if (dataWithoutId.editors && Array.isArray(dataWithoutId.editors)) {
            const editorsData: UserData[] = await Promise.all(
              dataWithoutId.editors.map(async (editorId) => {
                const editorDocRef = doc(db, "users", editorId);
                const editorDoc = await getDoc(editorDocRef);
                return editorDoc.exists()
                  ? {
                      uid: editorDoc.id,
                      displayName: editorDoc.data().displayName || "ユーザー",
                      avatarUrl: editorDoc.data().avatarUrl || undefined,
                    }
                  : { uid: editorId, displayName: "ユーザー", avatarUrl: undefined };
              })
            );
            setEditors(editorsData);
          }
        } else {
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
    return <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  if (!article) {
    return <div className="max-w-3xl mx-auto px-4 py-8">
      <p className="text-center text-gray-600 dark:text-gray-400">記事が見つかりません。</p>
    </div>;
  }

  const canEdit = () => (currentUser?.uid && (currentUser.uid === article.authorId || article.editors?.includes(currentUser.uid))) || false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <article className="bg-white rounded-lg shadow-lg overflow-hidden dark:bg-gray-800 p-8">
        <div className="flex justify-between items-start">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{article.title}</h1>
          {canEdit() && (
            <Link to={`/articles/${article.id}/edit`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center">
              <Edit className="h-5 w-5 mr-1" />編集
            </Link>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-2">
            {author?.avatarUrl ? (
              <Link to={`/users/${author.uid}`}>
                <img src={author.avatarUrl} alt={`${author.displayName}のアバター`} className="h-6 w-6 rounded-full object-cover" loading="lazy" />
              </Link>
            ) : <User className="h-6 w-6 text-gray-400" />}
            <span>{author?.displayName || "ユーザー"}</span>
            <Editors editors={editors} showNames={false} />
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>{article.created_at?.seconds ? format(new Date(article.created_at.seconds * 1000), 'PPP', { locale: ja }) : "不明な日付"}</span>
          </div>
        </div>
        <div className="prose prose-indigo max-w-none dark:prose-dark mt-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>{children}</code>
                );
              }
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
};

export default ArticleDetail;

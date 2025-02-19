// ArticleDetail.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive"; // remark-directive をインポート
import { visit } from "unist-util-visit";
import { Calendar, User, Edit } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Article } from "../types/Article";
import Editors from "../components/Editors.tsx";

// Firebase Authentication
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

interface UserData {
  uid: string;
  displayName: string;
  avatarUrl?: string;
}

// Tailwind CSS を用いた Admonition コンポーネント（ライト／ダークテーマ対応）
const Admonition: React.FC<{ type: string; children: React.ReactNode }> = ({ type, children }) => {
  // type に応じた Tailwind のクラスを設定
  let classes = "";
  switch (type) {
    case "info":
      classes = "bg-blue-100 dark:bg-blue-900 border-blue-500 dark:border-blue-400 text-blue-800 dark:text-blue-200";
      break;
    case "note":
      classes = "bg-purple-100 dark:bg-purple-900 border-purple-500 dark:border-purple-400 text-purple-800 dark:text-purple-200";
      break;
    case "tip":
      classes = "bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-400 text-green-800 dark:text-green-200";
      break;
    case "caution":
      classes = "bg-yellow-100 dark:bg-yellow-900 border-yellow-500 dark:border-yellow-400 text-yellow-800 dark:text-yellow-200";
      break;
    case "danger":
      classes = "bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200";
      break;
    default:
      classes = "bg-gray-100 dark:bg-gray-900 border-gray-500 dark:border-gray-400 text-gray-800 dark:text-gray-200";
      break;
  }
  return (
    <div className={`p-4 border-l-4 rounded-md ${classes} mb-4`}>
      <strong className="block mb-2">{type.toUpperCase()}</strong>
      <div>{children}</div>
    </div>
  );
};

// remark-directive を利用したカスタムプラグイン
const remarkAdmonitionsPlugin = () => {
  return (tree: any) => {
    visit(tree, (node) => {
      // Markdown 内のコンテナディレクティブ（:::info など）を検出
      if (node.type === "containerDirective") {
        // node.name に admonition の種類 (info, note, tip, caution, danger) が入る
        const type = node.name;
        if (!node.data) node.data = {};
        // HTML 出力時に div タグに変換し、クラス名を付与
        node.data.hName = "div";
        node.data.hProperties = { className: `admonition admonition-${type}` };
      }
    });
  };
};

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

  const canEdit = () =>
    (currentUser?.uid &&
      (currentUser.uid === article.authorId || article.editors?.includes(currentUser.uid))) ||
    false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <article className="bg-white rounded-lg shadow-lg overflow-hidden dark:bg-gray-800 p-8">
        <div className="flex justify-between items-start">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{article.title}</h1>
          {canEdit() && (
            <Link
              to={`/articles/${article.id}/edit`}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 flex items-center"
            >
              <Edit className="h-5 w-5 mr-1" />
              編集
            </Link>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-2">
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
            <Editors editors={editors} showNames={false} />
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>
              {article.created_at?.seconds
                ? format(new Date(article.created_at.seconds * 1000), "PPP", { locale: ja })
                : "不明な日付"}
            </span>
          </div>
        </div>
        <div className="prose prose-indigo max-w-none dark:prose-dark mt-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkDirective, remarkAdmonitionsPlugin]}
            components={{
              // コードブロックのシンタックスハイライト設定
              code({ inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "");
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="pre"
                    {...props}
                  >
                    {String(children).trim()}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              // admonition 用の div をカスタムレンダリング
              div({ node, className, ...props }) {
                if (className && className.startsWith("admonition")) {
                  // className は "admonition admonition-〇〇" の形式となるため、
                  // "admonition-" 部分を除いた文字列をタイプとする
                  const type = className.replace("admonition admonition-", "");
                  return (
                    <Admonition type={type} {...props}>
                      {props.children}
                    </Admonition>
                  );
                }
                return <div {...props} />;
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

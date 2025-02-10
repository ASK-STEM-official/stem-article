// editor.tsx
// この記事エディタコンポーネントは、タイトル入力、タグ入力・選択、編集者選択、Markdownエディタ、画像アップロードモーダルなど、
// AddArticle.tsx と EditArticle.tsx の共通部分をまとめたコンポーネントです。

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// ※一旦 remark-admonitions をコメントアウトして動作確認してください
// import remarkAdmonitions from "remark-admonitions";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// ユーザー情報の型定義（編集者情報などに利用）
export interface UserData {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

// EditorProps インターフェース
export interface EditorProps {
  // タイトル入力
  title: string;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // タグ管理用プロパティ
  tagSearch: string;
  onTagSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  allTags: string[];
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;

  // Discord 紹介用チェックボックス（AddArticle 用にのみ利用可能なオプション）
  discordFlag?: boolean;
  onDiscordFlagChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // 編集者（共同編集者）管理用プロパティ
  editorSearch: string;
  onEditorSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  allUsers: UserData[];
  selectedEditors: UserData[];
  onAddEditor: (user: UserData) => void;
  onRemoveEditor: (uid: string) => void;

  // Markdown コンテンツ管理用プロパティ
  markdownContent: string;
  onMarkdownContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onInsertAtCursor: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;

  // 画像アップロードモーダル管理用プロパティ
  showImageModal: boolean;
  setShowImageModal: (value: boolean) => void;
  selectedImageFile: File | null;
  onImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  handleUploadImage: () => void;
}

/**
 * ArticleEditor コンポーネント
 * --- 動作説明 ---
 * ・タイトル、タグ、編集者の入力と一覧表示
 * ・Markdown エディタ部分（ツールバー付きテキストエリアとリアルタイムプレビュー）
 *   ※エディタ側のスクロールに合わせ、プレビュー側も同じ比率で自動スクロールします。
 * ・画像アップロードモーダル
 *
 * ツールバーには見出し、太字、斜体、リンク、コードブロック、リスト、引用に加えて、
 * Docusaurus 形式のアドモニション記法（::: tip ... :::）も簡単に挿入できるボタンを配置しています。
 */
const ArticleEditor: React.FC<EditorProps> = (props) => {
  const {
    title,
    onTitleChange,
    tagSearch,
    onTagSearchChange,
    allTags,
    selectedTags,
    onAddTag,
    onRemoveTag,
    discordFlag,
    onDiscordFlagChange,
    editorSearch,
    onEditorSearchChange,
    allUsers,
    selectedEditors,
    onAddEditor,
    onRemoveEditor,
    markdownContent,
    onMarkdownContentChange,
    onInsertAtCursor,
    textareaRef,
    showImageModal,
    setShowImageModal,
    selectedImageFile,
    onImageFileChange,
    isUploading,
    handleUploadImage,
  } = props;

  // プレビュー用コンテナの参照（エディタのスクロールに合わせて自動スクロールするため）
  const previewRef = React.useRef<HTMLDivElement>(null);

  // エディタ側のスクロールに合わせ、プレビュー側も同じ比率でスクロールする処理
  const handleEditorScroll = () => {
    if (!textareaRef.current || !previewRef.current) return;
    const editor = textareaRef.current;
    const preview = previewRef.current;
    const scrollRatio =
      editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    preview.scrollTop =
      scrollRatio * (preview.scrollHeight - preview.clientHeight);
  };

  return (
    <div>
      {/* タイトル入力 */}
      <div className="form-group">
        <label htmlFor="title" className="block text-gray-700 dark:text-gray-300">
          タイトル
        </label>
        <input
          type="text"
          id="title"
          placeholder="タイトル"
          value={title}
          onChange={onTitleChange}
          required
          className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* タグ入力 */}
      <div className="form-group">
        <label className="block text-gray-700 dark:text-gray-300 mb-2">タグを追加</label>
        <input
          type="text"
          placeholder="タグを検索または新規作成"
          value={tagSearch}
          onChange={onTagSearchChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              const trimmed = tagSearch.trim();
              if (trimmed !== "") {
                onAddTag(trimmed);
              }
            }
          }}
          className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {tagSearch && (
          <ul className="border border-gray-300 dark:border-gray-600 mt-2 max-h-40 overflow-y-auto">
            {allTags
              .filter(
                (t) =>
                  t.toLowerCase().includes(tagSearch.toLowerCase()) &&
                  !selectedTags.includes(t)
              )
              .map((tag) => (
                <li
                  key={tag}
                  className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                  onClick={() => onAddTag(tag)}
                >
                  {tag}
                </li>
              ))}
            {allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()))
              .length === 0 && (
              <li
                className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                onClick={() => onAddTag(tagSearch)}
              >
                新規タグ作成: {tagSearch}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* 選択されたタグの表示 */}
      {selectedTags.length > 0 && (
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">選択されたタグ</label>
          <ul className="space-y-2">
            {selectedTags.map((tag) => (
              <li
                key={tag}
                className="flex items-center justify-between px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              >
                <span className="text-gray-800 dark:text-gray-100">{tag}</span>
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="text-red-500 hover:text-red-700"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Discord 紹介用チェックボックス（オプション） */}
      {typeof discordFlag === "boolean" && onDiscordFlagChange && (
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">
            Discordに紹介する
            <input
              type="checkbox"
              className="ml-2"
              checked={discordFlag}
              onChange={onDiscordFlagChange}
            />
          </label>
        </div>
      )}

      {/* 編集者追加 */}
      <div className="form-group">
        <label className="block text-gray-700 dark:text-gray-300 mb-2">編集者を追加</label>
        <input
          type="text"
          placeholder="編集者を検索"
          value={editorSearch}
          onChange={onEditorSearchChange}
          className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {editorSearch && (
          <ul className="border border-gray-300 dark:border-gray-600 mt-2 max-h-40 overflow-y-auto">
            {allUsers
              .filter((u) => {
                const lowName = (u.displayName || "").toLowerCase();
                const lowSearch = editorSearch.toLowerCase();
                return (
                  lowName.includes(lowSearch) &&
                  !selectedEditors.find((ed) => ed.uid === u.uid)
                );
              })
              .map((user) => (
                <li
                  key={user.uid}
                  className="px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                  onClick={() => onAddEditor(user)}
                >
                  <div className="flex items-center">
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-6 h-6 rounded-full mr-2"
                    />
                    <span className="text-gray-800 dark:text-gray-100">
                      {user.displayName}
                    </span>
                  </div>
                </li>
              ))}
            {allUsers.filter((u) => {
              const lowName = (u.displayName || "").toLowerCase();
              const lowSearch = editorSearch.toLowerCase();
              return (
                lowName.includes(lowSearch) &&
                !selectedEditors.find((ed) => ed.uid === u.uid)
              );
            }).length === 0 && (
              <li className="px-3 py-2 text-gray-500 dark:text-gray-400">
                該当するユーザーが見つかりません。
              </li>
            )}
          </ul>
        )}
      </div>

      {/* 選択された編集者の表示 */}
      {selectedEditors.length > 0 && (
        <div className="form-group">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">現在の編集者</label>
          <ul className="space-y-2">
            {selectedEditors.map((editor) => (
              <li
                key={editor.uid}
                className="flex items-center justify-between px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              >
                <div className="flex items-center">
                  <img
                    src={editor.avatarUrl}
                    alt={editor.displayName}
                    className="w-6 h-6 rounded-full mr-2"
                  />
                  <span className="text-gray-800 dark:text-gray-100">
                    {editor.displayName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveEditor(editor.uid)}
                  className="text-red-500 hover:text-red-700"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Markdown エディタ部分 */}
      <div className="form-group">
        <label className="block text-gray-700 dark:text-gray-300 mb-2">
          内容 (Markdown)
        </label>
        <div className="flex flex-col md:flex-row gap-4">
          {/* 左側：テキストエディタ＋ツールバー */}
          <div className="w-full md:w-1/2">
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onInsertAtCursor("# ")}
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                見出し
              </button>
              <button
                type="button"
                onClick={() => onInsertAtCursor("**太字**")}
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                太字
              </button>
              <button
                type="button"
                onClick={() => onInsertAtCursor("*斜体*")}
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                斜体
              </button>
              <button
                type="button"
                onClick={() => onInsertAtCursor("[リンク](http://)")}
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                リンク
              </button>
              <button
                type="button"
                onClick={() => onInsertAtCursor("```\npython\nprint(\"test\")\n```")}
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                コードブロック
              </button>
              <button
                type="button"
                onClick={() => onInsertAtCursor("- ")}
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                リスト
              </button>
              <button
                type="button"
                onClick={() => onInsertAtCursor("> ")}
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                引用
              </button>
              {/* アドモニション挿入用ボタン */}
              <button
                type="button"
                onClick={() =>
                  onInsertAtCursor("::: tip\nここに内容を入力\n:::\n")
                }
                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
              >
                アドモニション
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={markdownContent}
              onChange={onMarkdownContentChange}
              onScroll={handleEditorScroll}
              placeholder="ここに Markdown を入力"
              className="w-full h-80 p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="mt-2 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              画像追加
            </button>
          </div>
          {/* 右側：リアルタイムプレビュー */}
          <div
            ref={previewRef}
            className="w-full md:w-1/2 overflow-y-auto p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
          >
            {markdownContent.trim() ? (
              <div
                className="prose prose-indigo max-w-none dark:prose-dark"
                key={`${markdownContent}-${JSON.stringify({})}`}
              >
                <ReactMarkdown
                  remarkPlugins={[
                    remarkGfm,
                    // ※以下 remarkAdmonitions をコメントアウトまたは設定を見直す
                    // [remarkAdmonitions, { tag: ":::", keywords: { tip: "tip", note: "note", warning: "warning", danger: "danger" } }]
                  ]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                    // 画像は、必要に応じて画像マッピング処理等を追加してください
                    img: ({ node, ...props }) => {
                      return (
                        <img
                          src={props.src}
                          alt={props.alt || ""}
                          style={{ maxWidth: "100%" }}
                        />
                      );
                    },
                    // コードブロックのシンタックスハイライト
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const codeString = Array.isArray(children)
                        ? children[0]
                        : "";
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {codeString.replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {markdownContent}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-gray-500">プレビューがここに表示されます</p>
            )}
          </div>
        </div>
      </div>

      {/* 画像アップロード用モーダル */}
      {showImageModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-80">
            <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">
              画像をアップロード
            </h2>
            <input
              type="file"
              accept="image/*"
              onChange={onImageFileChange}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleUploadImage}
                disabled={isUploading}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                アップロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleEditor;

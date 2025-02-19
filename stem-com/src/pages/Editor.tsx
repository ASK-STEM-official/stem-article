<<<<<<< HEAD
// Editor.tsx
// このコンポーネントは、Markdown形式の本文を入力・編集するための共通エディタです。
// 左側にはツールバー付きのテキストエリア、右側にはリアルタイムプレビューを表示します。
// さらに、画像アップロード機能を内包しており、画像アップロード時はBase64形式の画像を読み込み、
// 本文中に「/images/xxxxx」というプレースホルダー付き画像記法を挿入します。

import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// 画像データの型定義（Base64データとファイル名）
interface ImageMapping {
  [key: string]: { base64: string; filename: string };
}

// Editorコンポーネントのプロパティの型定義
interface EditorProps {
  markdownContent: string;
  setMarkdownContent: (value: string) => void;
  imageMapping: ImageMapping;
  setImageMapping: React.Dispatch<React.SetStateAction<ImageMapping>>;
}

/**
 * Editorコンポーネント
 * Markdown形式の本文を編集するためのコンポーネントです。
 * 左側にMarkdown入力エリア（ツールバー付き）、右側にリアルタイムプレビューを表示します。
 * 画像アップロード機能も内包しており、アップロードした画像はプレースホルダー付き記法として本文に挿入されます。
 */
const Editor: React.FC<EditorProps> = ({
  markdownContent,
  setMarkdownContent,
  imageMapping,
  setImageMapping,
}) => {
  // テキストエリアの参照（カーソル位置の管理用）
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 画像アップロードモーダルの表示状態
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  // 選択された画像ファイル
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  // アップロード中かどうかの状態
  const [isUploading, setIsUploading] = useState<boolean>(false);

  /**
   * カーソル位置に指定のテキストを挿入する関数
   * @param text 挿入するテキスト
   */
  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const before = markdownContent.slice(0, selectionStart);
    const after = markdownContent.slice(selectionEnd);
    const updated = before + text + after;
    setMarkdownContent(updated);
    // 挿入後のカーソル位置を調整
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = selectionStart + text.length;
        textareaRef.current.selectionEnd = selectionStart + text.length;
      }
    }, 0);
  };

  /**
   * 画像アップロード処理
   * 画像ファイルをBase64形式に変換し、Markdownにプレースホルダー付き画像記法を挿入します。
   */
  const handleUploadImage = () => {
    if (!selectedImageFile) {
      alert("画像ファイルを選択してください。");
      return;
    }
    if (isUploading) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!result || typeof result !== "string" || result.trim() === "") {
        alert("画像の読み込みに失敗しました。ファイルが無効です。");
        setIsUploading(false);
        return;
      }
      const base64Data = result.trim();
      // nanoid等のライブラリでユニークID生成するところですが、ここでは簡易的にMath.randomで生成
      const id = Math.random().toString(36).substr(2, 6);
      const placeholder = `/images/${id}`;
      // Markdownにプレースホルダー付き画像記法を追加
      const imageMarkdown = `\n![画像: ${selectedImageFile.name}](${placeholder})\n`;
      setMarkdownContent((prev) => prev + imageMarkdown);
      // imageMappingに画像データを登録
      setImageMapping((prev) => ({
        ...prev,
        [id]: { base64: base64Data, filename: selectedImageFile.name },
      }));
      setShowImageModal(false);
      setSelectedImageFile(null);
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("画像の読み込みに失敗しました。");
      setIsUploading(false);
    };
    reader.readAsDataURL(selectedImageFile);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* 左側：Markdown入力エリアとツールバー */}
      <div className="w-full md:w-1/2">
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => insertAtCursor("# ")}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            見出し
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("**太字**")}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            太字
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("*斜体*")}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            斜体
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("[リンク](http://)")}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            リンク
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("```\nコード\n```")}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            コードブロック
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("- ")}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            リスト
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("> ")}
            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            引用
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={markdownContent}
          onChange={(e) => setMarkdownContent(e.target.value)}
          placeholder="ここにMarkdownを入力"
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
      {/* 右側：Markdownリアルタイムプレビュー */}
      <div className="w-full md:w-1/2 overflow-y-auto p-2 border rounded bg-white dark:bg-gray-700 dark:text-white">
        {markdownContent.trim() ? (
          <div className="prose prose-indigo max-w-none dark:prose-dark">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // 画像レンダラー：プレースホルダーの場合はimageMappingからBase64を取得
                img: ({ node, ...props }) => {
                  if (
                    props.src &&
                    typeof props.src === "string" &&
                    props.src.startsWith("/images/")
                  ) {
                    const id = props.src.replace("/images/", "");
                    const mapped = imageMapping[id];
                    if (mapped && mapped.base64.trim() !== "") {
                      return (
                        <img
                          src={mapped.base64}
                          alt={props.alt || `画像: ${mapped.filename}`}
                          style={{ maxWidth: "100%" }}
                        />
                      );
                    }
                    return <span style={{ color: "red" }}>画像読み込みエラー: {id}</span>;
                  }
                  return <img src={props.src} alt={props.alt || ""} style={{ maxWidth: "100%" }} />;
                },
                // コードブロックレンダラー
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
=======
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
  // selectedImageFile プロパティは使用されていないため削除
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
    // selectedImageFile を削除
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

>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
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
<<<<<<< HEAD
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setSelectedImageFile(e.target.files[0]);
                }
              }}
=======
              onChange={onImageFileChange}
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
<<<<<<< HEAD
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImageFile(null);
                }}
=======
                onClick={() => setShowImageModal(false)}
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92
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

<<<<<<< HEAD
export default Editor;
=======
export default ArticleEditor;
>>>>>>> d04c71f22131422236ddbb5988b51464c5d23a92

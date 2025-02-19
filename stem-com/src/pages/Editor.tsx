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
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setSelectedImageFile(e.target.files[0]);
                }
              }}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImageFile(null);
                }}
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

export default Editor;

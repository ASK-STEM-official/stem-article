// Editor.tsx
// このコンポーネントは、Markdown形式の本文を入力・編集するための共通エディタです。
// 左側にはツールバー付きのテキストエリア、右側にはリアルタイムプレビューを表示します。
// さらに、画像アップロード機能を内包しており、画像アップロード時はBase64形式の画像を読み込み、
// 本文中に「/images/xxxxx」というプレースホルダー付き画像記法を挿入します。
// Admonitions 機能（:::info, :::dangerなど）にも対応。

import React, { useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Admonitions 用のコンポーネント
const Admonition: React.FC<{ type: string; children: React.ReactNode }> = ({ type, children }) => {
  let containerClasses = "";
  let headerColorClass = "";

  switch (type) {
    case "info":
      containerClasses =
        "bg-blue-100 dark:bg-blue-900 border-blue-500 dark:border-blue-400 text-blue-800 dark:text-blue-200";
      headerColorClass = "text-blue-800 dark:text-blue-200";
      break;
    case "note":
      containerClasses =
        "bg-purple-100 dark:bg-purple-900 border-purple-500 dark:border-purple-400 text-purple-800 dark:text-purple-200";
      headerColorClass = "text-purple-800 dark:text-purple-200";
      break;
    case "tip":
      containerClasses =
        "bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-400 text-green-800 dark:text-green-200";
      headerColorClass = "text-green-800 dark:text-green-200";
      break;
    case "caution":
      containerClasses =
        "bg-yellow-100 dark:bg-yellow-900 border-yellow-500 dark:border-yellow-400 text-yellow-800 dark:text-yellow-200";
      headerColorClass = "text-yellow-800 dark:text-yellow-200";
      break;
    case "danger":
      containerClasses =
        "bg-red-100 dark:bg-red-900 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200";
      headerColorClass = "text-red-800 dark:text-red-200";
      break;
    default:
      containerClasses =
        "bg-gray-100 dark:bg-gray-900 border-gray-500 dark:border-gray-400 text-gray-800 dark:text-gray-200";
      headerColorClass = "text-gray-800 dark:text-gray-200";
      break;
  }

  return (
    <div className={`p-4 border-l-4 rounded-md mb-4 ${containerClasses}`}>
      <strong className={`block mb-2 font-bold ${headerColorClass}`}>
        {type.toUpperCase()}
      </strong>
      <div>{children}</div>
    </div>
  );
};

// Admonitions を認識するための remarkプラグイン
const remarkAdmonitionsPlugin = () => {
  return (tree: any) => {
    visit(tree, (node) => {
      if (node.type === "containerDirective") {
        const type = node.name;
        if (!node.data) node.data = {};
        node.data.hName = "div";
        node.data.hProperties = {
          className: `admonition admonition-${type}`,
        };
      }
    });
  };
};

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
 * また、Admonitions記法（:::info など）にも対応しています。
 */
const Editor: React.FC<EditorProps> = ({
  markdownContent,
  setMarkdownContent,
  imageMapping,
  setImageMapping,
}) => {
  // テキストエリアの参照（カーソル位置・スクロール同期用）
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // プレビューコンテナの参照（スクロール同期用）
  const previewRef = useRef<HTMLDivElement>(null);

  // スクロール同期中かどうかを示すフラグ (無限ループ防止)
  const isSyncingRef = useRef<boolean>(false);

  // 画像アップロードモーダルの表示状態
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  // 選択された画像ファイル
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  // アップロード中かどうかの状態
  const [isUploading, setIsUploading] = useState<boolean>(false);

  /**
   * 左（textarea）をスクロールしたとき、右（preview）も同期
   */
  const handleScrollLeft = useCallback(() => {
    // すでに同期中ならスキップ
    if (isSyncingRef.current) return;

    if (!textareaRef.current || !previewRef.current) return;
    const left = textareaRef.current;
    const right = previewRef.current;

    isSyncingRef.current = true;
    // スクロール量の割合を計算
    const ratio = left.scrollTop / (left.scrollHeight - left.clientHeight || 1);
    right.scrollTop = ratio * (right.scrollHeight - right.clientHeight);

    // 同期処理が終わったらフラグを戻す
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 0);
  }, []);

  /**
   * 右（preview）をスクロールしたとき、左（textarea）も同期
   */
  const handleScrollRight = useCallback(() => {
    if (isSyncingRef.current) return;

    if (!textareaRef.current || !previewRef.current) return;
    const left = textareaRef.current;
    const right = previewRef.current;

    isSyncingRef.current = true;
    const ratio = right.scrollTop / (right.scrollHeight - right.clientHeight || 1);
    left.scrollTop = ratio * (left.scrollHeight - left.clientHeight);

    setTimeout(() => {
      isSyncingRef.current = false;
    }, 0);
  }, []);

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
      // 簡易的なユニークID
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
    // 高さを固定し、左右を並べる
    <div className="h-[600px] flex gap-4">
      {/* 左エリア */}
      <div className="w-1/2 flex flex-col border rounded bg-white dark:bg-gray-700 dark:text-white">
        {/* ツールバー */}
        <div className="flex flex-wrap gap-2 p-2 border-b dark:bg-gray-600">
          <button
            type="button"
            onClick={() => insertAtCursor("# ")}
            className="bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            見出し
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("**太字**")}
            className="bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            太字
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("*斜体*")}
            className="bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            斜体
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("[リンク](http://)")}
            className="bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            リンク
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("```\nコード\n```")}
            className="bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            コード
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("- ")}
            className="bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            リスト
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("> ")}
            className="bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            引用
          </button>
          {/* Admonitions用ボタン */}
          <button
            type="button"
            onClick={() => insertAtCursor(":::info\nここに情報を書く\n:::")}
            className="bg-blue-300 dark:bg-blue-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            Info
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor(":::note\nここにノートを書く\n:::")}
            className="bg-purple-300 dark:bg-purple-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            Note
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor(":::tip\nここにヒントを書く\n:::")}
            className="bg-green-300 dark:bg-green-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            Tip
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor(":::caution\nここに注意を書く\n:::")}
            className="bg-yellow-300 dark:bg-yellow-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            Caution
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor(":::danger\nここに警告を書く\n:::")}
            className="bg-red-300 dark:bg-red-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
          >
            Danger
          </button>
          {/* 画像追加ボタン */}
          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 ml-auto"
          >
            画像追加
          </button>
        </div>

        {/* テキストエリア: overflow-auto + スクロールイベント */}
        <textarea
          ref={textareaRef}
          onScroll={handleScrollLeft}
          value={markdownContent}
          onChange={(e) => setMarkdownContent(e.target.value)}
          placeholder="ここにMarkdownを入力"
          className="flex-1 p-2 bg-white dark:bg-gray-700 dark:text-white outline-none resize-none overflow-auto"
        />
      </div>

      {/* 右エリア: プレビュー */}
      <div
        ref={previewRef}
        onScroll={handleScrollRight}
        className="w-1/2 border rounded p-4 bg-white dark:bg-gray-700 dark:text-white overflow-auto"
      >
        {markdownContent.trim() ? (
          <div className="prose prose-indigo max-w-none dark:prose-dark">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkDirective, remarkAdmonitionsPlugin]}
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
                    return (
                      <span style={{ color: "red" }}>
                        画像読み込みエラー: {id}
                      </span>
                    );
                  }
                  return (
                    <img
                      src={props.src}
                      alt={props.alt || ""}
                      style={{ maxWidth: "100%" }}
                    />
                  );
                },
                // コードブロック: 言語ラベル表示
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  // children が配列の場合、文字列結合して取得
                  const codeString = Array.isArray(children)
                    ? children.join("")
                    : String(children);

                  if (!inline && match) {
                    return (
                      <div className="relative my-4">
                        {/* 言語ラベル */}
                        <div className="absolute right-2 top-2 text-xs bg-gray-800 text-white px-2 py-0.5 rounded">
                          {match[1]}
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {codeString.replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      </div>
                    );
                  } else {
                    // インラインコード or 言語指定なし
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                },
                // Admonitions 用の div -> <Admonition>
                div({ className, children, ...props }) {
                  if (className && className.startsWith("admonition")) {
                    const type = className.replace("admonition admonition-", "");
                    return <Admonition type={type}>{children}</Admonition>;
                  }
                  return (
                    <div className={className} {...props}>
                      {children}
                    </div>
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

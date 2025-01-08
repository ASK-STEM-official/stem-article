// src/components/Editors.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { User } from 'lucide-react';
import Modal from "./Modal.tsx";

interface Editor {
  uid: string;
  displayName: string;
  avatarUrl?: string;
}

interface EditorsProps {
  editors: Editor[];
  showNames?: boolean; // 表示名を制御するプロパティ
}

const Editors: React.FC<EditorsProps> = ({ editors, showNames = true }) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  if (editors.length === 0) return null;

  if (editors.length === 1) {
    const editor = editors[0];
    return (
      <div className="flex items-center space-x-2 mt-2">
        {editor.avatarUrl ? (
          <Link to={`/users/${editor.uid}`}>
            <img
              src={editor.avatarUrl}
              alt={`${editor.displayName}のアバター`}
              className="h-6 w-6 rounded-full object-cover"
              loading="lazy"
            />
          </Link>
        ) : (
          <User className="h-6 w-6 text-gray-400" />
        )}
        {showNames && (
          <Link to={`/users/${editor.uid}`} className="text-sm text-gray-700 dark:text-gray-300 hover:underline">
            {editor.displayName}
          </Link>
        )}
      </div>
    );
  }

  const displayEditors = editors.slice(0, 5);
  const remaining = editors.length - 5;

  return (
    <div className="flex items-center space-x-2 mt-2">
      {displayEditors.map((editor) => (
        <Link key={editor.uid} to={`/users/${editor.uid}`}>
          {editor.avatarUrl ? (
            <img
              src={editor.avatarUrl}
              alt={`${editor.displayName}のアバター`}
              className="h-6 w-6 rounded-full object-cover border-2 border-indigo-600"
              loading="lazy"
            />
          ) : (
            <User className="h-6 w-6 text-gray-400" />
          )}
        </Link>
      ))}
      {remaining > 0 && (
        <>
          <button
            onClick={() => setIsModalOpen(true)}
            className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 border-2 border-indigo-600"
            title="さらに表示"
          >
            …
          </button>

          {/* モーダルコンポーネント */}
          {isModalOpen && (
            <Modal onClose={() => setIsModalOpen(false)}>
              <h2 className="text-xl font-bold mb-4">編集者一覧</h2>
              <ul className="space-y-4">
                {editors.map((editor) => (
                  <li key={editor.uid} className="flex items-center space-x-3">
                    {editor.avatarUrl ? (
                      <Link to={`/users/${editor.uid}`}>
                        <img
                          src={editor.avatarUrl}
                          alt={`${editor.displayName}のアバター`}
                          className="h-10 w-10 rounded-full object-cover border-2 border-indigo-600"
                          loading="lazy"
                        />
                      </Link>
                    ) : (
                      <User className="h-10 w-10 text-gray-400" />
                    )}
                    {showNames && (
                      <Link to={`/users/${editor.uid}`} className="text-lg font-medium text-gray-800 dark:text-gray-100 hover:underline">
                        {editor.displayName}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Modal>
          )}
        </>
      )}
    </div>
  );
};

export default Editors;

// FloatingButton.tsx
import React from "react";
import { Link } from "react-router-dom";
import { PenLine } from "lucide-react"; // 記事投稿に使うアイコン

const FloatingButton: React.FC = () => {
  return (
    <div className="fixed bottom-8 right-8">
      <Link
        to="/add-article"
        className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <PenLine className="w-6 h-6" />
      </Link>
    </div>
  );
};

export default FloatingButton;

// src/pages/Profile.tsx
import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase/db.ts";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  displayName: string;
  bio: string;
  avatarUrl: string;
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>({
    displayName: "",
    bio: "",
    avatarUrl: "",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          const initialProfile: UserProfile = {
            displayName: user.displayName || user.email || "ユーザー",
            bio: "",
            avatarUrl: user.photoURL || "",
          };
          await setDoc(userDocRef, initialProfile);
          setProfile(initialProfile);
        }
      } else {
        navigate("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const userDocRef = doc(db, "users", auth.currentUser?.uid || "");
      await setDoc(
        userDocRef,
        {
          displayName: profile.displayName,
          bio: profile.bio,
        },
        { merge: true }
      );

      alert("プロフィールを更新しました！");
    } catch (error) {
      console.error("プロフィール更新エラー:", error);
      alert("プロフィールの更新に失敗しました。");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">読み込み中...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">プロフィール</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 flex flex-col items-center">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt="プロフィール"
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-300 mb-2"></div>
          )}
        </div>
        <div className="mb-4">
          <label htmlFor="displayName" className="block text-gray-700">表示名</label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={profile.displayName}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="bio" className="block text-gray-700">自己紹介</label>
          <textarea
            id="bio"
            name="bio"
            value={profile.bio}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
            rows={4}
          ></textarea>
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">
          更新
        </button>
      </form>
    </div>
  );
};

export default Profile;

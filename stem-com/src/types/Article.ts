export interface Article {
    id: string;
    title: string;
    content: string;
    authorId: string;
    authorAvatarUrl?: string;
    created_at?: { seconds: number; nanoseconds: number };
    discord?: boolean;
    editors?: string[];
    tags?: string[]; 
  }
  
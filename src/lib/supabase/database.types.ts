export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          auth_user_id: string;
          artist_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          artist_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          artist_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      social_posts: {
        Row: {
          id: string;
          auth_user_id: string;
          song_title: string;
          artist: string;
          caption: string;
          recording_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          song_title: string;
          artist: string;
          caption?: string;
          recording_path: string;
          created_at?: string;
        };
        Update: {
          song_title?: string;
          artist?: string;
          caption?: string;
          recording_path?: string;
        };
        Relationships: [];
      };
      social_post_likes: {
        Row: {
          post_id: string;
          auth_user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          auth_user_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          auth_user_id?: string;
        };
        Relationships: [];
      };
      social_post_comments: {
        Row: {
          id: string;
          post_id: string;
          auth_user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          auth_user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

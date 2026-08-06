/**
 * 構築済みスキーマに対応する型定義。
 *
 * 本来は `npx supabase gen types typescript` で生成するのが望ましいが、
 * ここでは要件定義書の SQL と手で対応させている。SQL を変更したら
 * このファイルも必ず追従させること。
 */

export type UserRole = "student" | "staff" | "general";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type MembershipStatus = "pending" | "active" | "rejected";
export type CircleRole = "admin" | "member";
export type EventVisibility = "internal" | "public";
export type FacilityCategory = "facility" | "equipment";

/**
 * postgrest-js は各テーブル定義に `Relationships` があることを前提に
 * select() の戻り値型を解決する。これが無いと結果が object 型に解決されず、
 * スプレッド等がコンパイルエラーになる。
 *
 * 埋め込みリソースの型は `.returns<T>()` で明示している（lib/events.ts 参照）ため、
 * ここでは空配列で足りる。`supabase gen types` に移行する際はこのヘルパーごと
 * 生成物で置き換えること。
 */
type WithRelationships<T> = {
  [K in keyof T]: T[K] & { Relationships: [] };
};

export type Database = {
  public: {
    Tables: WithRelationships<{
      universities: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
      };
      users: {
        Row: { id: string; role: UserRole; name: string; created_at: string };
        Insert: {
          id: string;
          role: UserRole;
          name: string;
          created_at?: string;
        };
        Update: { id?: string; role?: UserRole; name?: string };
      };
      student_profiles: {
        Row: {
          user_id: string;
          university_id: string | null;
          enrollment_year: number | null;
          bio: string | null;
          skills: string[] | null;
        };
        Insert: {
          user_id: string;
          university_id?: string | null;
          enrollment_year?: number | null;
          bio?: string | null;
          skills?: string[] | null;
        };
        Update: {
          university_id?: string | null;
          enrollment_year?: number | null;
          bio?: string | null;
          skills?: string[] | null;
        };
      };
      staff_profiles: {
        Row: { user_id: string; university_id: string | null };
        Insert: { user_id: string; university_id?: string | null };
        Update: { university_id?: string | null };
      };
      circles: {
        Row: {
          id: string;
          university_id: string | null;
          name: string;
          description: string | null;
          status: ApprovalStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          university_id?: string | null;
          name: string;
          description?: string | null;
          status?: ApprovalStatus;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: ApprovalStatus;
        };
      };
      circle_members: {
        Row: {
          id: string;
          circle_id: string | null;
          user_id: string | null;
          role: CircleRole;
          status: MembershipStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          circle_id: string;
          user_id: string;
          role?: CircleRole;
          status?: MembershipStatus;
          created_at?: string;
        };
        Update: { role?: CircleRole; status?: MembershipStatus };
      };
      events: {
        Row: {
          id: string;
          host_university_id: string | null;
          host_circle_id: string | null;
          title: string;
          description: string | null;
          event_date: string;
          visibility: EventVisibility;
          target_grades: string[] | null;
          created_at: string;
        };
        /**
         * 排他的関連 (Exclusive Arc): CHECK 制約 `events_host_check` により
         * host_university_id / host_circle_id は「ちょうど片方だけが NOT NULL」。
         * 型レベルでも強制するため `EventHostInsert` を使うこと。
         */
        Insert: EventHostInsert & {
          id?: string;
          title: string;
          description?: string | null;
          event_date: string;
          visibility?: EventVisibility;
          target_grades?: string[] | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          event_date?: string;
          visibility?: EventVisibility;
          target_grades?: string[] | null;
        };
      };
      facilities: {
        Row: {
          id: string;
          university_id: string | null;
          name: string;
          category: FacilityCategory | null;
          is_available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          name: string;
          category?: FacilityCategory | null;
          is_available?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          category?: FacilityCategory | null;
          is_available?: boolean;
        };
      };
      facility_reservations: {
        Row: {
          id: string;
          facility_id: string | null;
          booked_by_user_id: string | null;
          group_circle_id: string | null;
          start_time: string;
          end_time: string;
          purpose: string | null;
          status: ApprovalStatus;
          created_at: string;
        };
        Insert: ReservationBookerInsert & {
          id?: string;
          facility_id: string;
          start_time: string;
          end_time: string;
          purpose?: string | null;
          status?: ApprovalStatus;
          created_at?: string;
        };
        Update: {
          start_time?: string;
          end_time?: string;
          purpose?: string | null;
          status?: ApprovalStatus;
        };
      };
    }>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

/**
 * イベント主催者の排他的関連を型で表現したもの。
 * 大学主催なら host_circle_id は必ず null、サークル主催ならその逆。
 * これにより CHECK 制約違反をコンパイル時に弾ける。
 */
export type EventHostInsert =
  | { host_university_id: string; host_circle_id?: null }
  | { host_university_id?: null; host_circle_id: string };

/**
 * 施設予約の予約主体の排他的関連。
 * 個人予約なら booked_by_user_id、サークル予約なら group_circle_id のどちらか一方。
 *
 * 注意: 要件定義書の SQL には facility_reservations 側の CHECK 制約が
 * 含まれていない。DB 側にも制約を追加することを推奨（README 参照）。
 */
export type ReservationBookerInsert =
  | { booked_by_user_id: string; group_circle_id?: null }
  | { booked_by_user_id?: null; group_circle_id: string };

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

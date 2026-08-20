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
export type EventVisibility = "internal" | "scoped" | "public";
/** サークル／イベント共通の可視範囲・参加資格スコープ（0003_scopes.sql） */
export type Scope = "university" | "scoped" | "public";
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
      circle_activities: {
        Row: {
          id: string;
          circle_id: string;
          title: string;
          activity_date: string;
          location: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          circle_id: string;
          title: string;
          activity_date: string;
          location?: string | null;
          note?: string | null;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          activity_date?: string;
          location?: string | null;
          note?: string | null;
        };
      };
      activity_attendances: {
        Row: {
          id: string;
          activity_id: string;
          user_id: string;
          status: "present" | "absent";
          recorded_by: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          user_id: string;
          status: "present" | "absent";
          recorded_by?: string | null;
        };
        Update: { status?: "present" | "absent" };
      };
      circle_posts: {
        Row: {
          id: string;
          circle_id: string;
          author_id: string | null;
          body: string;
          is_pinned: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          circle_id: string;
          author_id?: string | null;
          body: string;
          is_pinned?: boolean;
        };
        Update: { body?: string; is_pinned?: boolean };
      };
      event_participants: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: "going" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          status?: "going" | "cancelled";
        };
        Update: { status?: "going" | "cancelled" };
      };
      circle_universities: {
        Row: { circle_id: string; university_id: string };
        Insert: { circle_id: string; university_id: string };
        Update: { university_id?: string };
      };
      event_universities: {
        Row: { event_id: string; university_id: string };
        Insert: { event_id: string; university_id: string };
        Update: { university_id?: string };
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
          scope: Scope;
          created_at: string;
        };
        Insert: {
          id?: string;
          university_id?: string | null;
          name: string;
          description?: string | null;
          status?: ApprovalStatus;
          scope?: Scope;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          status?: ApprovalStatus;
          scope?: Scope;
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
    Functions: {
      /** サークル設立。作成した circle の id を返す（0002_circles.sql） */
      create_circle: {
        Args: {
          p_name: string;
          p_description?: string;
          p_scope?: Scope;
          p_university_ids?: string[];
        };
        Returns: string;
      };
      /** ある大学がサークルの対象範囲に入っているか（0003_scopes.sql） */
      circle_allows_university: {
        Args: { p_circle_id: string; p_university_id: string | null };
        Returns: boolean;
      };
      /** 参加申請。'requested' | 'already_requested' | 'already_member' を返す */
      request_join_circle: {
        Args: { p_circle_id: string };
        Returns: string;
      };
      /** メンバーの承認 / 却下（サークル管理者のみ） */
      decide_circle_member: {
        Args: { p_circle_id: string; p_user_id: string; p_approve: boolean };
        Returns: undefined;
      };
      /** サークル設立の承認 / 却下（大学職員のみ） */
      decide_circle: {
        Args: { p_circle_id: string; p_approve: boolean };
        Returns: undefined;
      };
      /** 施設予約の申請。予約 id を返す（0004_facilities.sql） */
      create_reservation: {
        Args: {
          p_facility_id: string;
          p_start: string;
          p_end: string;
          p_purpose?: string;
          p_circle_id?: string;
        };
        Returns: string;
      };
      /** 予約の承認 / 却下（大学職員のみ） */
      decide_reservation: {
        Args: { p_reservation_id: string; p_approve: boolean };
        Returns: undefined;
      };
      /** 予約の取り消し（申請者本人またはサークル管理者） */
      cancel_reservation: {
        Args: { p_reservation_id: string };
        Returns: undefined;
      };
      /** 施設の登録（大学職員のみ） */
      create_facility: {
        Args: { p_name: string; p_category?: string };
        Returns: string;
      };
      /** 施設の利用可否の切り替え（大学職員のみ） */
      set_facility_availability: {
        Args: { p_facility_id: string; p_available: boolean };
        Returns: undefined;
      };
      /** イベント作成。作成した event の id を返す（0005_events.sql） */
      create_event: {
        Args: {
          p_title: string;
          p_event_date: string;
          p_description?: string;
          p_visibility?: EventVisibility;
          p_circle_id?: string;
          p_target_grades?: string[];
          p_university_ids?: string[];
        };
        Returns: string;
      };
      /** イベント削除（主催者本人のみ） */
      delete_event: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      /** 施設・備品の編集（大学職員のみ・0006_facility_management.sql） */
      update_facility: {
        Args: { p_facility_id: string; p_name: string; p_category: string };
        Returns: undefined;
      };
      /** 施設・備品の削除（大学職員のみ。今後の予約が残る場合は拒否） */
      delete_facility: {
        Args: { p_facility_id: string };
        Returns: undefined;
      };
      /** 活動の登録（0012_activities.sql。管理者のみ） */
      create_activity: {
        Args: {
          p_circle_id: string;
          p_title: string;
          p_activity_date: string;
          p_location?: string;
          p_note?: string;
        };
        Returns: string;
      };
      /** 活動の削除（管理者のみ） */
      delete_activity: { Args: { p_activity_id: string }; Returns: undefined };
      /** 出欠の登録。user_id 省略時は自分自身 */
      set_attendance: {
        Args: { p_activity_id: string; p_status: string; p_user_id?: string };
        Returns: undefined;
      };
      /** サークル掲示板への投稿（0011_circle_posts.sql） */
      create_circle_post: {
        Args: { p_circle_id: string; p_body: string; p_pinned?: boolean };
        Returns: string;
      };
      /** 投稿の削除（投稿者本人または管理者） */
      delete_circle_post: { Args: { p_post_id: string }; Returns: undefined };
      /** お知らせへの固定・解除（管理者のみ） */
      set_post_pinned: {
        Args: { p_post_id: string; p_pinned: boolean };
        Returns: undefined;
      };
      /** 職員による学生登録（0010。'registered' | 'updated' を返す） */
      register_student: {
        Args: { p_email: string; p_name: string; p_enrollment_year?: number };
        Returns: string;
      };
      /** 職員による学生情報の修正 */
      update_student_info: {
        Args: { p_user_id: string; p_name: string; p_enrollment_year?: number };
        Returns: undefined;
      };
      /** 職員が自大学の学生を一覧する */
      list_university_students: {
        Args: Record<string, never>;
        Returns: {
          student_id: string;
          student_name: string;
          student_email: string | null;
          student_enrollment: number | null;
          student_created_at: string;
        }[];
      };
      /** プロフィール更新（0009_profile.sql。対象は常に自分自身） */
      update_my_profile: {
        Args: {
          p_name: string;
          p_bio?: string;
          p_skills?: string[];
          p_enrollment_year?: number;
        };
        Returns: undefined;
      };
      /** イベント参加登録（0007_event_participants.sql） */
      join_event: { Args: { p_event_id: string }; Returns: string };
      /** イベント参加の取り消し */
      leave_event: { Args: { p_event_id: string }; Returns: undefined };
      /** イベントが指定大学から見えるか */
      event_visible_to_university: {
        Args: { p_event_id: string; p_university_id: string | null };
        Returns: boolean;
      };
    };
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

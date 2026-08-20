# UniCircle Connect

大学のサークル活動の管理、イベントの告知、大学施設の予約を行うプラットフォーム。

**技術スタック**: Next.js 16 (App Router) / TypeScript / Tailwind CSS v4 / Supabase

---

## セットアップ

### 1. 環境変数

`.env.local` に以下を設定します。

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 2. データベース

**Supabase の SQL Editor で `supabase/setup_all.sql` の中身を貼って実行してください。** 構築に必要な
3ファイルを連結した生成物なので、1回で完了します。

全マイグレーションとシードを連結した生成物なので、1回で完了します。
成功すると `universities=3 / circles=4 / events=5 / facilities=5` と表示されます。

シードデータの投入は実質必須です。`universities` が空だとサインアップ画面の
大学選択肢が空になり、学生アカウントを作成できません。

<details>
<summary>個別に実行したい場合</summary>

`supabase/migrations/` を番号順に実行し、最後に `supabase/seed.sql` を流します。

| ファイル | 内容 |
| --- | --- |
| `0000_initial_schema.sql` | テーブル・制約・インデックス |
| `0001_handle_new_user.sql` | サインアップ時の自動プロフィール生成トリガー |
| `0002_circles.sql` | サークルの設立・参加・承認 |
| `0003_scopes.sql` | 3段階スコープ（自大学 / 指定大学 / 全公開） |
| `0004_facilities.sql` | 施設予約と二重予約の排他制約 |
| `0005_events.sql` | イベントの作成・削除 |
| `0006_facility_management.sql` | 施設の編集・削除 |
| `0007_event_participants.sql` | イベント参加登録 |
| `0008_rls.sql` | RLS ポリシー |

</details>

### 作り直したいとき

`supabase/reset_full.sql` を実行してから、上の手順をやり直します。

> このスクリプトは public スキーマを丸ごと削除して作り直します。
> テーブル名に依存しないため、旧スキーマの残骸も確実に消えます。
> 元に戻せないので、作り直す意図があるときだけ実行してください。
> 登録済みアカウント（`auth.users`）の削除はスクリプト内で
> コメントアウトしてあり、外すかどうかは利用者が判断します。

### SQL の正はこのリポジトリです

Supabase Studio の「保存済みスニペット」は使い捨ての作業場として扱い、
恒久的な定義は必ず `supabase/` 配下に置いてください。Studio 側に
ためていくと、どれが最新か分からなくなります。

マイグレーションを編集したら、バンドルを再生成します。

```bash
npm run db:bundle
```

### 3. 起動

```bash
npm run dev
```

`/signup` から学生アカウントを作成すると、ダッシュボードまで到達できます。

> **Supabase の無料プランは、一定期間アクセスが無いとプロジェクトが
> 自動的に一時停止（pause）されます。** データは保持されており、
> ダッシュボードの `Resume project` で再開できます。再開すれば
> プロジェクト URL と anon key は変わらないため、`.env.local` の
> 変更は不要です。

### 4. デモデータ（任意）

`supabase/seed_demo.sql` を実行すると、6大学・サークル20・イベント83件などが
入り、カレンダーや一覧の見え方を確かめられます。
テストアカウントは `npm run db:users` で53名まとめて作成できます。

---

## ディレクトリ構成

```
app/
  actions/               Server Actions（auth / circles / events / facilities）
  (auth)/                ログイン・新規登録
  calendar/              カレンダー（絞り込みは URL クエリ）
  circles/               サークル一覧・詳細・設立申請
  dashboard/             ダッシュボード
  events/                イベント一覧・詳細・作成
  facilities/            施設一覧・詳細（予約フォーム）
  reservations/          自分の予約 / 職員の承認キュー
components/              UI コンポーネント
lib/
  supabase.ts            接続情報 + ブラウザ用クライアント
  supabase-server.ts     サーバー用クライアント（next/headers 依存）
  dal.ts                 認証・認可の集約層（Data Access Layer）
  circles.ts             サークル取得クエリ
  events.ts              イベント取得クエリと可視判定
  calendar.ts            カレンダーの分類ロジック（server-only）
  event-sources.ts       カレンダーの表示用定数（クライアントからも参照）
  facilities.ts          施設・予約の取得クエリ
  dev-users.mjs          開発用テストユーザーの名簿（唯一の定義）
  database.types.ts      スキーマに対応する型定義
proxy.ts                 セッション更新と楽観的リダイレクト
supabase/
  migrations/            DB マイグレーション（0000〜0008）
  seed.sql               基本のテストデータ
  seed_demo.sql          デモ用の大量データ
  setup_all.sql          マイグレーション+seed の連結（生成物）
  reset_full.sql         【破壊的】作り直し用の初期化スクリプト
scripts/
  bundle-sql.sh          setup_all.sql の生成
  seed-users.mjs         テストユーザーの一括作成
```

---

## この Next.js は 16 系です

学習データや既存記事と挙動が異なる点があります。実装時は
`node_modules/next/dist/docs/` を参照してください。特に以下に注意。

| 項目 | Next.js 16 での扱い |
| --- | --- |
| Middleware | **`proxy.ts` に改称**。`middleware.ts` は読み込まれない |
| `cookies()` | 非同期。`await cookies()` が必要 |
| `searchParams` / `params` | Promise。`await` が必要 |
| `cacheComponents` | 任意。本プロジェクトでは未使用（Cookie 認証は動的レンダリング前提のため） |

Supabase 側にも版差があります。`@supabase/ssr` 0.12 以降、`setAll` は
**第2引数で no-store 系ヘッダーを受け取ります**。これを
レスポンスに反映しないと、CDN が認証 Cookie 付きレスポンスを
キャッシュして別ユーザーにセッションが渡る恐れがあります
（`proxy.ts` で対応済み）。

---

## 設計上の判断と注意点

### `lib/supabase.ts` を2ファイルに分けている理由

要件定義書では「Supabase のクライアント初期化は `lib/supabase.ts` で行う」と
していますが、SSR 環境ではブラウザ用とサーバー用でクライアントを
分ける必要があります。サーバー用は `next/headers` に依存するため、
同じファイルに置くと Client Component から import された瞬間に
ビルドが壊れます。

そのため接続情報とブラウザ用クライアントを `lib/supabase.ts` に、
サーバー用を `lib/supabase-server.ts` に分離しました。

### role の自己申告を禁止している

`signUp()` の `options.data` は `raw_user_meta_data` にそのまま入るため、
**完全にクライアント（＝攻撃者）の制御下**にあります。ここを信用して
`role` をそのまま保存すると、誰でも curl 一発で `staff` 権限
（施設マスタ管理・サークル承認権限）を持つアカウントを作れてしまいます。

対策として、トリガー側でセルフサインアップ可能なロールを
`student` / `general` のみに制限しています。`staff` の付与は管理者が
`promote_to_staff()` を手動実行する運用です。

```sql
select public.promote_to_staff('staff@univ.ac.jp', '<university_id>');
```

### RLS の方針

**書き込みは RPC が唯一の経路です。** 全 RPC を `SECURITY DEFINER` にし、
テーブルには INSERT / UPDATE / DELETE ポリシーを一切作っていません。
REST API を直接叩いてテーブルへ書き込もうとしても拒否されます。

こうしている理由は、権限判定を1か所に集めるためです。RPC を
`SECURITY INVOKER` のままにすると、RPC 内部の INSERT も呼び出し元の RLS に
従うため、書き込みを許すポリシーを別途書くことになり、判定が
「RPC 内の IF 文」と「RLS ポリシー」に二重化します。

**読み取りは SELECT ポリシーで可視範囲を表現しています。**
アプリ側のクエリと同じ規則を DB にも持たせているため、REST を直接
叩かれても学内限定イベントや他人の予約は読めません。

| テーブル | 読める人 |
| --- | --- |
| `universities` | 全員（未ログインのサインアップ画面に必要） |
| `users` | ログイン済み（メンバー一覧の氏名表示） |
| `student_profiles` | 本人 / 同じサークルの仲間 / 所属大学の職員 |
| `circles` | 承認済みは全員、承認待ちは関係者のみ |
| `circle_members` | 本人 / 同じサークルの仲間 / その大学の職員 |
| `events` | 可視範囲の判定に従う（未ログインは public のみ） |
| `event_participants` | 本人 / そのイベントの主催者 |
| `facilities` | 自大学のみ |
| `facility_reservations` | 本人 / サークルのメンバー / 施設の大学の職員 |

ポリシーから同じテーブルを参照する関数を呼ぶと無限再帰になるため、
判定用ヘルパー（`app_role()` `app_is_circle_member()` など）は
すべて `SECURITY DEFINER` にして RLS を迂回させています。

### スキーマの不一致を補っています（対応済み）

要件定義書の本文には「`facility_reservations` の予約主体は CHECK 制約により
どちらか1つのみが NULL でないことを保証している」とありますが、
**添付の SQL に該当の CHECK 制約が含まれていませんでした**
（`events` 側の `events_host_check` のみ存在）。

`0000_initial_schema.sql` では `reservations_booker_check` として
この制約を補っています。あわせて、終了時刻が開始時刻より後であることを
保証する `reservations_time_check` も追加しました。

TypeScript 側でも `ReservationBookerInsert` 型
（`lib/database.types.ts`）で排他性を表現しているため、
アプリ経由の INSERT は型と DB 制約の両方で守られています。

### 型定義について

`lib/database.types.ts` は要件定義書の SQL と手で対応させています。
スキーマを変更したら必ず追従させてください。将来的には生成に
切り替えるのが安全です。

```bash
npx supabase gen types typescript --project-id <ref> > lib/database.types.ts
```

---

## 実装済みの範囲

- **認証** — サインアップ / ログイン / ログアウト、セッション更新、ロール別プロフィールの自動生成
- **サークル** — 設立申請、職員による承認、参加申請、メンバー管理
- **イベント** — 作成・一覧・詳細・削除、参加登録
- **施設予約** — 予約申請、職員による承認、備品の日またぎ貸出、施設マスタ管理
- **スコープ** — サークル・イベントとも 自大学 / 指定大学 / 全公開 の3段階
- **カレンダー** — 月表示、分類ごとの色分け、絞り込みと検索
- **RLS** — 読み取りは可視範囲どおり、書き込みは RPC のみ

### 未実装

- マイページ（プロフィール編集、参加履歴）
- サークルのお知らせ・掲示板
- 活動記録と出欠管理
- メール確認後のコールバック（`/auth/callback`）
- 通知

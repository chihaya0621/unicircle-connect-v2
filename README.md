# UniCircle Connect

大学のサークル活動を、申請から日々の連絡まで一箇所で扱うためのプラットフォーム。

紙とメールと掲示板に散らばっている手続き――サークルの設立申請、職員の承認、
施設の予約、イベントの告知、部内の連絡――をひとつのアプリにまとめています。
高校生や企業の方には、ログインなしで各大学の公開サークルとイベントを見せます。

**技術スタック**: Next.js 16 (App Router) / TypeScript / Tailwind CSS v4 / Supabase (PostgreSQL + Auth + Storage)

---

## どんなアプリか

利用者は3種類で、見えるものと出来ることが役割ごとに変わります。

### 学生

- **カレンダー** — ログイン後の着地点。参加予定のイベントを月表示と直近5件のカードで見る
- **サークル** — 設立を申請する、参加を申し込む、メンバーと活動記録を見る、退会する
- **イベント** — サークル・大学のイベントを見て参加登録する。開始の何分前に知らせるかを1件ずつ選べる
- **掲示板** — 所属サークルごとの連絡。貼った紙は2週間で自然に下がり、お知らせに固定したものだけ残る
- **施設予約** — 教室・備品の空きを見て予約を申請する
- **マイページ** — プロフィール、参加履歴、予約履歴、通知設定、表示テーマ

### 職員（大学の事務）

- **承認** — サークルの設立・廃止、施設予約の申請を承認／却下する。**誰がいつ何を通したかが記録に残る**
- **承認のきまり** — 設立と廃止に何人の承認を求めるかを大学ごとに決める（1〜5人）
- **マスタ管理** — 学生の登録、キャンパス、施設・備品
- **イベント** — 大学主催のイベントを作る。学外の方にも案内するかを選べる

### 一般（高校生・企業）／未ログイン

- **サークルを探す** — 都道府県 → 大学 → サークル と辿る。キャンパス単位で探せる
- **気になる大学・サークル** — 見る大学を指定しておく、サークルをお気に入りに入れる
- **イベント** — 学外向けに公開されたものだけが並ぶ（オープンキャンパス・学祭など）
- 閲覧が目的なので、**イベントの参加登録と施設予約はできません**
- 一般アカウントは自分で退会できます（学生・職員は大学が管理する情報なので不可）

---

## セットアップ

### 1. 環境変数

`.env.local` に以下を設定します。

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 2. データベース

**Supabase の SQL Editor で `supabase/setup_all.sql` の中身を貼って実行してください。**
全マイグレーションとシードを連結した生成物なので、1回で完了します。
成功すると `universities=3 / circles=4 / events=5 / facilities=5` と表示されます。

シードデータの投入は実質必須です。`universities` が空だとサインアップ画面の
大学選択肢が空になり、学生アカウントを作成できません。

<details>
<summary>個別に実行したい場合</summary>

`supabase/migrations/` を番号順に実行し、最後に `supabase/seed.sql` を流します。
`0012` は欠番です（別のマイグレーションに吸収されました）。

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
| `0009_profile.sql` | プロフィール更新 |
| `0010_student_registration.sql` | 学生情報の登録を職員の管理下に置く |
| `0011_circle_posts.sql` | サークル掲示板 |
| `0013_event_attendance.sql` | イベントの出欠記録 |
| `0014_notifications.sql` | アプリ内通知 |
| `0015_images.sql` | 画像（Storage のバケットとポリシー） |
| `0016_theme.sql` | 表示テーマの個人設定 |
| `0017_theme_variants.sql` | テーマの配色バリエーション |
| `0018_circle_event_stats.sql` | 活動記録に出す参加人数 |
| `0019_public_discovery.sql` | 一般ユーザー向けの公開情報・お気に入り |
| `0020_event_participation_roles.sql` | 参加登録を学生に限る |
| `0021_circle_public_profile.sql` | サークルの公開プロフィール |
| `0022_event_reminders.sql` | 参加イベントのリマインド |
| `0023_university_details.sql` | 大学マスタの拡充とキャンパス |
| `0024_campus_location.sql` | キャンパスの所在地（県をまたぐ大学） |
| `0025_public_events.sql` | 学外向けイベントの掲載可否 |
| `0026_membership_and_edits.sql` | 退会・除名と、サークル／イベントの編集 |
| `0027_approvals.sql` | 承認の記録と、複数人による承認 |
| `0028_reservation_log_and_account.sql` | 予約の承認記録と、アカウントの削除 |

</details>

#### リマインド通知を動かすには（任意）

`0022` はリマインドの配信を `pg_cron` で5分おきに回します。拡張が無い環境でも
マイグレーションは通りますが、**配信は動きません**。有効にするには Supabase の
Database → Extensions で `pg_cron` を有効化してから `0022` を流し直してください。

#### パスワード再設定を動かすには

Supabase の Authentication → URL Configuration に
`http://localhost:3000/auth/callback` を追加してください。
再設定メールのリンクがここに戻ってきます。

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

マイグレーションを追加したら、`scripts/bundle-sql.sh` の `SOURCES` に足して
バンドルを再生成します。

```bash
npm run db:bundle
```

### 3. 起動

```bash
npm run dev
```

`/signup` から一般アカウントを作れます。学生・職員は自分では作れない設計なので
（後述）、動かして確かめるときは次のデモデータを入れてください。

> **Supabase の無料プランは、一定期間アクセスが無いとプロジェクトが
> 自動的に一時停止（pause）されます。** データは保持されており、
> ダッシュボードの `Resume project` で再開できます。再開すれば
> プロジェクト URL と anon key は変わらないため、`.env.local` の
> 変更は不要です。

### 4. デモデータ（任意）

| 順 | 実行するもの | 内容 |
| --- | --- | --- |
| 1 | `npm run db:users` | テストアカウント59名を作成 |
| 2 | `supabase/promote_staff.sql` | 学生・職員のロールと公式情報を付与（1 の生成物） |
| 3 | `supabase/seed_demo.sql` | 大学を3校追加、サークル16、各大学に施設・備品40件 |
| 4 | `supabase/seed_demo_activity.sql` | イベント200超・参加登録・出欠・掲示板・予約 |
| 5 | `npm run db:activity` | 通知を発生させるデモ操作 |
| 6 | `supabase/seed_public_directory.sql` | 架空の40大学・54キャンパス・289サークル・316イベント |
| 7 | `supabase/seed_review_scenarios.sql` | 承認・廃止・退会の各状態を作った確認用データ |

パスワードは全員共通で `devpassword123`、一覧は [`docs/dev-users.md`](docs/dev-users.md) にあります。
開発サーバーではログイン画面にクイックログインのパネルが出ます。

数人だけ足したいときは、メールアドレスの一部で絞れます。1件ずつ間隔を空けて
作るので、全員ぶん流すと数十秒かかります。

```bash
npm run db:users -- staff
```

`4` を実行すると、活動記録・掲示板・出欠がひととおり埋まった状態になります。
イベントの日時は実行時点からの相対で作られるので、いつ流しても当月前後に
データが載ります。**どれも何度実行しても増えません。**

`6` の大学名はすべて造語です。実在の大学と紛れないようにしています。

---

## ディレクトリ構成

```
app/
  actions/               Server Actions（役割ごとに1ファイル）
  (auth)/                ログイン・新規登録・パスワード再設定
  auth/callback/         メールのリンクから戻る先
  calendar/              カレンダー（ログイン後の着地点）
  circles/               サークル一覧・詳細・設立申請・承認キュー
  events/                イベント一覧・詳細・作成
  board/                 サークル掲示板（コルクボード）
  facilities/            施設一覧・詳細（予約フォーム）・マスタ管理
  reservations/          自分の予約 / 職員の承認キュー
  notifications/         通知一覧
  mypage/                プロフィール・履歴・通知設定・テーマ
  staff/students/        職員による学生の登録
components/              UI コンポーネント
lib/
  supabase.ts            接続情報 + ブラウザ用クライアント
  supabase-server.ts     サーバー用クライアント（next/headers 依存）
  dal.ts                 認証・認可の集約層（Data Access Layer）
  home.ts                役割ごとの着地点（ログインと proxy が共有）
  circles.ts             サークル取得クエリ
  events.ts              イベント取得クエリと可視判定
  approvals.ts           承認の記録と必要承認者数
  discovery.ts           都道府県・キャンパス・お気に入り
  board.ts               掲示板
  notifications.ts       通知
  mypage.ts              マイページの各種履歴
  calendar.ts            カレンダーの分類ロジック（server-only）
  event-sources.ts       カレンダーの表示用定数（クライアントからも参照）
  facilities.ts          施設・予約の取得クエリ
  prefectures.ts         都道府県の一覧と表記ゆれの吸収
  dev-users.mjs          開発用テストユーザーの名簿（唯一の定義）
  database.types.ts      スキーマに対応する型定義
proxy.ts                 セッション更新と楽観的リダイレクト
supabase/
  migrations/            DB マイグレーション（0000〜0028、0012 は欠番）
  seed.sql               基本のテストデータ
  seed_demo.sql          デモ用の大量データ
  seed_demo_activity.sql 活動・掲示板・予約のデモデータ
  seed_public_directory.sql  公開ディレクトリのデモデータ（生成物）
  seed_review_scenarios.sql  承認まわりの確認用データ
  promote_staff.sql      ロール付与（db:users の生成物）
  setup_all.sql          マイグレーション+seed の連結（生成物）
  reset_full.sql         【破壊的】作り直し用の初期化スクリプト
scripts/
  bundle-sql.sh          setup_all.sql の生成
  seed-users.mjs         テストユーザーの一括作成
  seed-activity.mjs      通知を発生させるデモ操作
  gen_public_seed.py     seed_public_directory.sql の生成
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

ルートを削除したあとは `.next` を消してください。消し忘れると、
削除済みのページを参照する型ファイルが残ってビルドが通りません。

```bash
rm -rf .next && npm run dev
```

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

対策として、セルフサインアップで作れるのは `general` だけに制限しています。
学生は職員が `register_student()` で登録し、職員の付与は管理者が
`promote_to_staff()` を手動実行する運用です。

```sql
select public.promote_to_staff('staff@univ.ac.jp', '<university_id>');
```

氏名や所属大学は大学が把握する公式情報なので、本人には変えさせません。
同じ理由で、学生・職員のアカウント削除の導線も置いていません。

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
| `universities` / `campuses` | 全員（未ログインの大学一覧に必要） |
| `users` | ログイン済み（メンバー一覧の氏名表示） |
| `student_profiles` | 本人 / 同じサークルの仲間 / 所属大学の職員 |
| `circles` | 学生・職員は承認済み全件、それ以外は公開設定のものだけ |
| `circle_members` | 本人 / 同じサークルの仲間 / その大学の職員 |
| `circle_posts` | そのサークルのメンバーのみ |
| `events` | 可視範囲の判定に従う（未ログインは公開かつ掲載可のみ） |
| `event_participants` | 本人 / そのイベントの主催者 |
| `facilities` | 自大学のみ |
| `facility_reservations` | 本人 / サークルのメンバー / 施設の大学の職員 |
| `approvals` | 対象そのものが読める人 |

ポリシーから同じテーブルを参照する関数を呼ぶと無限再帰になるため、
判定用ヘルパー（`app_role()` `app_is_circle_member()` など）は
すべて `SECURITY DEFINER` にして RLS を迂回させています。

> `0008_rls.sql` は末尾で全 RPC を `ALTER FUNCTION ... SECURITY DEFINER` に
> 揃えます。既存の RPC を後のマイグレーションで作り直すときは、
> **`security definer` を明示してください。** 書き忘れると `INVOKER` に
> 戻り、唯一の書き込み経路が静かに壊れます。
>
> 引数を増やして作り直すときは、先に `drop function` してください。
> `create or replace` は引数の並びが違うと**別の関数として増えます**。

### 承認は紙の決裁に合わせている

現行の紙の運用では、設立のような重い決裁に複数人の印鑑が要ります。
これに合わせて、承認は**溜まっていく**モデルにしました。

- サークルの**設立**と**廃止**は、大学が決めた人数（1〜5人）が揃って成立する
- **却下は1人で成立**する（1人が判を拒めば回覧は止まる、という紙の挙動）
- 同じ職員が二重に押すことはできない（`UNIQUE (target_type, target_id, approver_id)`）
- 誰がいつ何と言って通したかは `approvals` に残り、対象の詳細画面に出る
- **施設予約は日々の運用**なので、この人数は使わず1人で決まる

人数は「サークル一覧」の職員向けパネルで変えます。職員の在籍数を超える値は
DB 側で弾かれます。超えると誰も承認を完了できなくなるためです。

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

`lib/database.types.ts` は SQL と手で対応させています。
スキーマを変更したら必ず追従させてください。将来的には生成に
切り替えるのが安全です。

```bash
npx supabase gen types typescript --project-id <ref> > lib/database.types.ts
```

---

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm run db:bundle` | `setup_all.sql` を再生成 |
| `npm run db:users` | テストユーザーを作成（`-- <文字列>` で絞り込み） |
| `npm run db:activity` | 通知を発生させるデモ操作 |

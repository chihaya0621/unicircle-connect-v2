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

Supabase の SQL Editor で、以下を**上から順に**実行してください。
各ファイルの中身をコピーして貼り付けるだけです。

**`supabase/setup_all.sql` の中身を貼って実行するだけです。** 構築に必要な
3ファイルを連結した生成物なので、1回で完了します。

成功すると `universities=3 / circles=4 / events=5 / facilities=5` と表示されます。

シードデータの投入は実質必須です。`universities` が空だとサインアップ画面の
大学選択肢が空になり、学生アカウントを作成できません。

<details>
<summary>個別に実行したい場合</summary>

| 順 | ファイル | 内容 |
| --- | --- | --- |
| 1 | `supabase/migrations/0000_initial_schema.sql` | テーブル・制約・インデックス・RLS |
| 2 | `supabase/migrations/0001_handle_new_user.sql` | サインアップ時の自動プロフィール生成トリガー |
| 3 | `supabase/seed.sql` | 開発用テストデータ |

2 のトリガーは `auth.users` への INSERT を検知して、`public.users` と
`student_profiles` を同一トランザクションで生成します。

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

### 3. 起動

```bash
npm run dev
```

---

## ディレクトリ構成

```
app/
  actions/auth.ts        サインアップ・ログイン・ログアウトの Server Actions
  (auth)/login           ログイン画面
  (auth)/signup          新規登録画面
  dashboard/             ログイン必須のダッシュボード
  events/                イベント一覧（ロールに応じて可視範囲が変わる）
components/              UI コンポーネント
lib/
  supabase.ts            接続情報 + ブラウザ用クライアント
  supabase-server.ts     サーバー用クライアント（next/headers 依存）
  dal.ts                 認証・認可の集約層（Data Access Layer）
  events.ts              イベント取得クエリ
  database.types.ts      スキーマに対応する型定義
proxy.ts                 セッション更新と楽観的リダイレクト
supabase/
  migrations/
    0000_initial_schema.sql   テーブル・制約・インデックス・RLS
    0001_handle_new_user.sql  サインアップ時のトリガー
  seed.sql               開発用テストデータ
  setup_all.sql          上記3つの連結（生成物・これを貼れば構築完了）
  reset_full.sql         【破壊的】作り直し用の初期化スクリプト
scripts/bundle-sql.sh    setup_all.sql の生成スクリプト
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

### 【要対応】RLS が全許可のままです

要件定義書のとおり、現在すべてのテーブルの RLS ポリシーは `true`
（全許可）です。つまり **anon key さえあれば誰でも全データを読み書きできます**。

イベント一覧の「一般ユーザーには公開イベントのみ見せる」制御は
現在アプリケーション側のクエリ (`lib/events.ts`) だけで行っており、
Supabase の REST API を直接叩かれれば学内限定イベントは読めてしまいます。
本番前に、同等のルールを必ず RLS ポリシーとして実装してください。

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

- 認証基盤（サインアップ / ログイン / ログアウト、セッション更新）
- ロール別のプロフィール自動生成（DB トリガー）
- 認可の集約層（`lib/dal.ts`）とルートガード
- イベント一覧（ロールに応じた可視範囲の出し分け）

### 未実装

サークル、施設予約、イベント作成 UI、メール確認後のコールバック
（`/auth/callback`）は未着手です。

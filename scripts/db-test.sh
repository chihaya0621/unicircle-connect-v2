#!/usr/bin/env bash
#
# データベースの検証を回す。
#
#   npm run db:test              … 全部
#   npm run db:test -- rls       … 名前に rls を含むものだけ
#
# 使い捨ての PostgreSQL を立てて、マイグレーションを 0000 から順に流し、
# supabase/tests/*.sql を実行する。本物の Supabase には触らない。
#
# なぜ本物に向けないか: RLS の検証は「見えないはずのものが見えない」ことを
# 確かめる作業で、失敗したときに何が起きたか分からないまま本番のデータを
# 汚す危険がある。毎回まっさらから作り直すほうが、結果も安定する。
#
set -euo pipefail
cd "$(dirname "$0")/.."

# ---- PostgreSQL のコマンドを探す -------------------------------------------
# Debian/Ubuntu はパスを通さないので、バージョン付きのディレクトリも見る。
if ! command -v initdb >/dev/null 2>&1; then
  for d in /usr/lib/postgresql/*/bin; do
    [ -x "$d/initdb" ] && export PATH="$d:$PATH" && break
  done
fi
if ! command -v initdb >/dev/null 2>&1; then
  echo "PostgreSQL が見つかりません。" >&2
  echo "  Ubuntu/WSL: sudo apt-get install -y postgresql" >&2
  echo "  macOS:      brew install postgresql@16" >&2
  exit 127
fi

FILTER="${1:-}"

# Unix ソケットのパスには長さの上限（約100字）がある。
# 作業ディレクトリの下に置くと、深い場所に clone したときだけ失敗する。
RUN="/tmp/uc-dbtest-$$"
DATA="$RUN/data"
SOCK="$RUN/sock"
mkdir -p "$DATA" "$SOCK"

cleanup() {
  pg_ctl -D "$DATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$RUN"
}
trap cleanup EXIT

echo "使い捨ての PostgreSQL を用意しています…"
initdb -D "$DATA" -U postgres --no-locale -E UTF8 >/dev/null
pg_ctl -D "$DATA" -o "-k $SOCK -h ''" -l "$RUN/pg.log" start >/dev/null

for _ in $(seq 1 40); do
  pg_isready -h "$SOCK" -q && break
  sleep 0.25
done

PSQL=(psql -h "$SOCK" -U postgres -d uc -v ON_ERROR_STOP=1 --quiet
       --tuples-only --no-align -P pager=off)
psql -h "$SOCK" -U postgres -q -c "CREATE DATABASE uc"

# ---- Supabase のふりをする --------------------------------------------------
# マイグレーションが前提にしている、本家が用意してくれる部分だけを作る。
"${PSQL[@]}" >/dev/null <<'SQL'
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
-- 本家の auth.uid() は JWT から読む。ここでは設定値から読ませて、
-- テストの中で「誰として実行しているか」を切り替えられるようにする。
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.uid', true), '')::uuid $$;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text, name text, owner uuid, created_at timestamptz DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO authenticated;
SQL

echo "マイグレーションを流しています…"
for f in supabase/migrations/0*.sql; do
  if ! "${PSQL[@]}" -f "$f" >/dev/null 2>"$RUN/err"; then
    echo "  ✗ $(basename "$f")" >&2; cat "$RUN/err" >&2; exit 1
  fi
done

# Supabase は新しいテーブルへの SELECT 権限を既定で配る。
# これを真似ないと、RLS ではなく権限不足で弾かれ、通ったつもりになる。
"${PSQL[@]}" >/dev/null <<'SQL'
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
SQL

"${PSQL[@]}" -f supabase/tests/_harness.sql  >/dev/null
"${PSQL[@]}" -f supabase/tests/_fixtures.sql >/dev/null

# ---- 検証 -------------------------------------------------------------------
pass=0; failed=0; failed_names=()
for f in supabase/tests/[0-9]*.sql; do
  name="$(basename "$f" .sql)"
  if [ -n "$FILTER" ] && [[ "$name" != *"$FILTER"* ]]; then continue; fi
  echo ""
  echo "▸ $name"
  # NOTICE を出したいので、エラーだけ捨てずに全部見せる
  if "${PSQL[@]}" -f "$f" 2>&1 | grep -vE "^(SET|RESET|DO|BEGIN|COMMIT)$" | grep -v "^$"; then
    pass=$((pass + 1))
  else
    failed=$((failed + 1)); failed_names+=("$name")
  fi
done

total=$("${PSQL[@]}" -tAc "SELECT count(*) FROM test.log" 2>/dev/null || echo 0)

echo ""
echo "────────────────────────────────────────"
if [ "$failed" -gt 0 ]; then
  echo "✗ 失敗 ${failed} 本: ${failed_names[*]}"
  exit 1
fi
if [ "$total" -eq 0 ]; then
  # 検査が1件も走っていないのに成功扱いにすると、
  # 「テストがある」という事実だけが残って中身が空になる
  echo "✗ 検査が1件も実行されていません"
  exit 1
fi
echo "✓ ${pass} 本 / 検査 ${total} 件 すべて通過"

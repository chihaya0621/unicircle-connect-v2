#!/usr/bin/env bash
#
# E2E を回す。
#
#   npm run test:e2e              … 全部
#   npm run test:e2e -- seal      … 名前に seal を含むものだけ
#   npm run test:e2e -- --headed  … ブラウザを見ながら
#
# 開発サーバー（3000）とは別のポート・別の出力先を使うので、
# 動かしたまま実行できる。
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo ".env.local がありません。Supabase の接続情報が要ります。" >&2
  exit 1
fi

# next build は tsconfig.json の include に出力先を書き足す。
# 検証用の出力先が混ざったままコミットされないよう、前後で元に戻す。
BACKUP="$(mktemp)"
cp tsconfig.json "$BACKUP"
restore() { cp "$BACKUP" tsconfig.json; rm -f "$BACKUP"; }
trap restore EXIT

# 開発サーバーが動いていると .next/types に古い型が残っている。
# tsconfig.json はそれも include しているので、削除済みのページを
# 指した型が混ざり、E2E のビルドだけが落ちる。検証用のビルドは
# 自分の出力先だけを見ればよいので、.next/ の include を外す。
node -e '
  const fs = require("fs");
  const c = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
  c.include = (c.include || []).filter((p) => !p.startsWith(".next/"));
  fs.writeFileSync("tsconfig.json", JSON.stringify(c, null, 2) + "\n");
'

echo "ビルドしています（出力先 .next-e2e）…"
# 本番と同じ条件にする。NEXT_PUBLIC_* はビルド時に埋め込まれるので、
# ここで渡さないとクイックログインの有無が本番とずれる。
NEXT_DIST_DIR=.next-e2e \
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=1 \
  npx next build > /dev/null

restore
trap - EXIT

npx playwright test "$@"

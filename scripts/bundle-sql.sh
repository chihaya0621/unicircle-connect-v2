#!/usr/bin/env bash
#
# supabase/setup_all.sql を生成する。
#
# SQL Editor に何度も貼り付けるのは手間なので、セットアップに必要な
# 3ファイルを1つに連結したものを用意する。個別ファイルから機械的に
# 生成するため、内容が食い違うことはない。
#
# 使い方: npm run db:bundle
#
set -euo pipefail

cd "$(dirname "$0")/.."

SOURCES=(
  "migrations/0000_initial_schema.sql"
  "migrations/0001_handle_new_user.sql"
  "migrations/0002_circles.sql"
  "migrations/0003_scopes.sql"
  "migrations/0004_facilities.sql"
  "migrations/0005_events.sql"
  "migrations/0006_facility_management.sql"
  "migrations/0007_event_participants.sql"
  "migrations/0008_rls.sql"
  "migrations/0009_profile.sql"
  "migrations/0010_student_registration.sql"
  "migrations/0011_circle_posts.sql"
  "migrations/0012_activities.sql"
  "migrations/0013_event_attendance.sql"
  "migrations/0014_notifications.sql"
  "migrations/0015_images.sql"
  "migrations/0016_theme.sql"
  "migrations/0017_theme_variants.sql"
  "migrations/0018_circle_event_stats.sql"
  "migrations/0019_public_discovery.sql"
  "seed.sql"
)

OUT="supabase/setup_all.sql"

{
  cat <<'HEADER_TOP'
-- =============================================================================
-- UniCircle Connect セットアップ一括実行ファイル（自動生成）
-- =============================================================================
--
-- このファイルは以下を連結した生成物です。直接編集しないでください。
HEADER_TOP

  # 一覧は SOURCES から組み立てる。手書きだと追加のたびに実体とずれる
  i=0
  for src in "${SOURCES[@]}"; do
    i=$((i + 1))
    printf -- '--  %2d. %s\n' "$i" "$src"
  done

  cat <<'HEADER'
--
-- 再生成: npm run db:bundle
--
-- 前提: public スキーマが空であること。
--       既存データがある場合は先に reset_full.sql を実行してください。
--
-- 成功すると最後に universities=3 / circles=4 / events=5 / facilities=5
-- が表示されます。
-- =============================================================================

HEADER

  for f in "${SOURCES[@]}"; do
    printf '\n-- ▼▼▼ %s ▼▼▼\n\n' "$f"
    cat "supabase/$f"
  done
} > "$OUT"

echo "生成しました: $OUT ($(wc -l < "$OUT") 行)"

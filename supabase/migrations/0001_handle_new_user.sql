-- =============================================================================
-- サインアップ時に public.users と各サブプロフィールを自動生成するトリガー
-- =============================================================================
-- Supabase SQL Editor でこのファイルの内容を実行してください。
--
-- 設計意図:
--   auth.users への INSERT と public.users への INSERT を同一トランザクション
--   に閉じ込めることで、「auth 上は存在するがアプリ上のユーザー行が無い」
--   孤児アカウントが発生しないようにする。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 【重要・セキュリティ】role の自己申告を禁止する
-- -----------------------------------------------------------------------------
-- raw_user_meta_data は signUp() の options.data がそのまま入る領域であり、
-- 完全にクライアント（＝攻撃者）の制御下にある。
-- したがって role をそのまま信用すると、誰でも curl 一発で staff 権限
-- （施設マスタ管理・サークル承認権限）を持つアカウントを作れてしまう。
--
-- 対策として、セルフサインアップで作れるのは 'student' と 'general' のみに
-- 制限する。staff は下部の promote_to_staff() で管理者が手動付与する。
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role            text;
  v_name            text;
  v_university_id   uuid;
  v_enrollment_year int;
begin
  -- role: student / general 以外は問答無用で general に落とす
  v_role := coalesce(v_meta ->> 'role', 'general');
  if v_role not in ('student', 'general') then
    v_role := 'general';
  end if;

  -- name: 未指定ならメールアドレスのローカル部で埋める（NOT NULL のため）
  v_name := nullif(btrim(coalesce(v_meta ->> 'name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;

  insert into public.users (id, role, name)
  values (new.id, v_role, v_name)
  on conflict (id) do nothing;

  -- 学生のみ student_profiles を持つ。general はサブプロフィールを持たない。
  if v_role = 'student' then
    -- 不正な UUID / 数値が来ても例外でサインアップ全体を落とさない
    begin
      v_university_id := nullif(v_meta ->> 'university_id', '')::uuid;
    exception when others then
      v_university_id := null;
    end;

    begin
      v_enrollment_year := nullif(v_meta ->> 'enrollment_year', '')::int;
    exception when others then
      v_enrollment_year := null;
    end;

    insert into public.student_profiles (user_id, university_id, enrollment_year)
    values (new.id, v_university_id, v_enrollment_year)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- staff への昇格（管理者が SQL Editor から手動実行する想定）
-- -----------------------------------------------------------------------------
-- 使い方:
--   select public.promote_to_staff('staff@univ.ac.jp', '<university_id>');
-- -----------------------------------------------------------------------------

create or replace function public.promote_to_staff(
  p_email         text,
  p_university_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email;

  if v_user_id is null then
    raise exception 'ユーザーが見つかりません: %', p_email;
  end if;

  update public.users set role = 'staff' where id = v_user_id;

  -- 学生から昇格した場合は student_profiles を除去して排他性を保つ
  delete from public.student_profiles where user_id = v_user_id;

  insert into public.staff_profiles (user_id, university_id)
  values (v_user_id, p_university_id)
  on conflict (user_id) do update set university_id = excluded.university_id;
end;
$$;

-- 一般ユーザーから直接叩けないよう実行権限を剥奪しておく。
-- anon / authenticated は Supabase 固有のロールなので、存在する場合のみ剥奪する
-- （ローカルの素の PostgreSQL でも流せるようにするため）。
revoke execute on function public.promote_to_staff(text, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.promote_to_staff(text, uuid) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.promote_to_staff(text, uuid) from authenticated;
  end if;
end $$;

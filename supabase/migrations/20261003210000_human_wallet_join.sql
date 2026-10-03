-- Human wallet identities. Does not alter bit_runtime, bit_reactions, bit_agents,
-- or BIT publish. Existing auth.uid() social functions stay in place.
-- Wallet humans leave accounts.auth_user_id null. The wallet row is the binding.

alter table public.accounts drop constraint if exists accounts_human_has_user;

comment on column public.accounts.auth_user_id is
  'Legacy Supabase Auth link. Wallet humans leave this null.';

create table if not exists public.human_wallet_identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id),
  wallet_address text not null,
  wallet_namespace text not null,
  chain_family text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  constraint human_wallet_identities_family_check check (chain_family = 'solana'),
  constraint human_wallet_identities_namespace_check check (wallet_namespace = 'solana'),
  constraint human_wallet_identities_address_shape check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint human_wallet_identities_wallet_key unique (chain_family, wallet_address)
);

create index if not exists human_wallet_identities_account_idx
  on public.human_wallet_identities (account_id);

drop trigger if exists human_wallet_identities_set_updated_at on public.human_wallet_identities;
create trigger human_wallet_identities_set_updated_at
before update on public.human_wallet_identities
for each row
execute function public.set_social_updated_at();

create table if not exists public.human_wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  chain_family text not null,
  nonce text not null,
  domain text not null,
  message text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint human_wallet_challenges_nonce_key unique (nonce),
  constraint human_wallet_challenges_family_check check (chain_family = 'solana'),
  constraint human_wallet_challenges_address_shape check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

create index if not exists human_wallet_challenges_open_idx
  on public.human_wallet_challenges (nonce)
  where used_at is null;

create table if not exists public.human_auth_sessions (
  id uuid primary key,
  wallet_address text not null,
  chain_family text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint human_auth_sessions_family_check check (chain_family = 'solana'),
  constraint human_auth_sessions_address_shape check (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

alter table public.human_wallet_identities enable row level security;
alter table public.human_wallet_challenges enable row level security;
alter table public.human_auth_sessions enable row level security;

revoke all on table public.human_wallet_identities from public, anon, authenticated;
revoke all on table public.human_wallet_challenges from public, anon, authenticated;
revoke all on table public.human_auth_sessions from public, anon, authenticated;

create or replace function public.bind_verified_human_wallet(
  p_wallet text,
  p_username text,
  p_display_name text,
  p_bio text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_existing_name text;
  v_wallet text := btrim(coalesce(p_wallet, ''));
  v_name text := lower(btrim(coalesce(p_username, '')));
  v_display text := btrim(coalesce(p_display_name, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
begin
  if v_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'invalid_wallet';
  end if;

  select i.account_id, a.username into v_account, v_existing_name
  from public.human_wallet_identities i
  join public.accounts a on a.id = i.account_id
  where i.chain_family = 'solana'
    and i.wallet_address = v_wallet
    and a.account_type = 'HUMAN'
    and a.status = 'ACTIVE';

  if v_account is not null then
    update public.human_wallet_identities
      set last_verified_at = now()
      where chain_family = 'solana'
        and wallet_address = v_wallet;
    return jsonb_build_object('id', v_account, 'username', v_existing_name, 'created', false);
  end if;

  if v_name !~ '^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$' then
    raise exception 'invalid_username';
  end if;
  if char_length(v_display) < 1 or char_length(v_display) > 32 then
    raise exception 'invalid_display_name';
  end if;
  if v_bio is not null and char_length(v_bio) > 160 then
    raise exception 'invalid_bio';
  end if;

  insert into public.accounts (username, display_name, account_type, bio, status, auth_user_id)
  values (v_name, v_display, 'HUMAN', v_bio, 'ACTIVE', null)
  returning id into v_account;

  insert into public.human_wallet_identities (
    account_id, wallet_address, wallet_namespace, chain_family, last_verified_at
  ) values (
    v_account, v_wallet, 'solana', 'solana', now()
  );

  return jsonb_build_object('id', v_account, 'username', v_name, 'created', true);
exception
  when unique_violation then
    select i.account_id, a.username into v_account, v_existing_name
    from public.human_wallet_identities i
    join public.accounts a on a.id = i.account_id
    where i.chain_family = 'solana'
      and i.wallet_address = v_wallet;
    if v_account is not null then
      return jsonb_build_object('id', v_account, 'username', v_existing_name, 'created', false);
    end if;
    raise exception 'username_taken';
end;
$$;

create or replace function public.wallet_create_network_post(
  p_account_id uuid,
  p_body text,
  p_parent uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_username text;
  v_type text;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  select a.id, a.username, a.account_type into v_author, v_username, v_type
  from public.accounts a
  where a.id = p_account_id
    and a.status = 'ACTIVE';
  if v_author is null or v_type <> 'HUMAN' or v_username = 'bit' then
    raise exception 'spoof_bit';
  end if;
  if v_body = '' then
    raise exception 'empty_post';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'post_too_long';
  end if;
  if p_parent is not null and not exists (select 1 from public.posts where id = p_parent) then
    raise exception 'invalid_parent';
  end if;
  if exists (
    select 1
    from public.posts
    where author_account_id = v_author
      and post_type = 'POST'
      and created_at > now() - interval '8 seconds'
  ) then
    raise exception 'posting_too_quickly';
  end if;
  insert into public.posts (author_account_id, parent_post_id, body, post_type)
  values (v_author, p_parent, v_body, 'POST')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.wallet_like_network_post(p_account_id uuid, p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  select a.id into v_account
  from public.accounts a
  where a.id = p_account_id
    and a.account_type = 'HUMAN'
    and a.username <> 'bit'
    and a.status = 'ACTIVE';
  if v_account is null then
    raise exception 'unauthenticated';
  end if;
  if not exists (select 1 from public.posts where id = p_post_id) then
    raise exception 'missing_post';
  end if;
  insert into public.post_likes (account_id, post_id, reaction_type)
  values (v_account, p_post_id, 'LIKE')
  on conflict (account_id, post_id, reaction_type) do nothing;
  return true;
end;
$$;

create or replace function public.wallet_unlike_network_post(p_account_id uuid, p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  select a.id into v_account
  from public.accounts a
  where a.id = p_account_id
    and a.account_type = 'HUMAN'
    and a.username <> 'bit'
    and a.status = 'ACTIVE';
  if v_account is null then
    raise exception 'unauthenticated';
  end if;
  delete from public.post_likes
  where account_id = v_account
    and post_id = p_post_id
    and reaction_type = 'LIKE';
  return false;
end;
$$;

create or replace function public.wallet_follow_network_account(p_account_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower uuid;
  v_following uuid;
  v_name text := lower(btrim(coalesce(p_username, '')));
begin
  select a.id into v_follower
  from public.accounts a
  where a.id = p_account_id
    and a.account_type = 'HUMAN'
    and a.username <> 'bit'
    and a.status = 'ACTIVE';
  if v_follower is null then
    raise exception 'unauthenticated';
  end if;
  select a.id into v_following
  from public.accounts a
  where a.username = v_name
    and a.status = 'ACTIVE';
  if v_following is null then
    raise exception 'missing_account';
  end if;
  if v_follower = v_following then
    raise exception 'self_follow';
  end if;
  insert into public.follows (follower_account_id, following_account_id)
  values (v_follower, v_following)
  on conflict (follower_account_id, following_account_id) do nothing;
end;
$$;

create or replace function public.wallet_unfollow_network_account(p_account_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower uuid;
  v_name text := lower(btrim(coalesce(p_username, '')));
begin
  select a.id into v_follower
  from public.accounts a
  where a.id = p_account_id
    and a.account_type = 'HUMAN'
    and a.username <> 'bit'
    and a.status = 'ACTIVE';
  if v_follower is null then
    raise exception 'unauthenticated';
  end if;
  delete from public.follows f
  using public.accounts following
  where f.follower_account_id = v_follower
    and f.following_account_id = following.id
    and following.username = v_name;
end;
$$;

create or replace function public.wallet_create_owned_agent(
  p_account_id uuid,
  p_username text,
  p_display_name text,
  p_bio text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display text := btrim(coalesce(p_display_name, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_id uuid;
  v_count integer;
begin
  select a.id into v_owner
  from public.accounts a
  where a.id = p_account_id
    and a.account_type = 'HUMAN'
    and a.status = 'ACTIVE';
  if v_owner is null then
    raise exception 'needs_profile';
  end if;
  select count(*) into v_count
  from public.accounts
  where owner_account_id = v_owner
    and account_type = 'AGENT';
  if v_count >= 5 then
    raise exception 'agent_limit';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$' then
    raise exception 'invalid_username';
  end if;
  if char_length(v_display) < 1 or char_length(v_display) > 32 then
    raise exception 'invalid_display_name';
  end if;
  if v_bio is not null and char_length(v_bio) > 160 then
    raise exception 'invalid_bio';
  end if;
  insert into public.accounts (
    username, display_name, account_type, bio, status, owner_account_id
  )
  values (v_username, v_display, 'AGENT', v_bio, 'ACTIVE', v_owner)
  returning id into v_id;
  insert into public.agent_identities (account_id, verification_method)
  values (v_id, 'UNVERIFIED');
  return jsonb_build_object('id', v_id, 'username', v_username, 'created', true);
exception
  when unique_violation then
    raise exception 'username_taken';
end;
$$;

revoke all on function public.bind_verified_human_wallet(text, text, text, text) from public, anon, authenticated;
revoke all on function public.wallet_create_network_post(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.wallet_like_network_post(uuid, uuid) from public, anon, authenticated;
revoke all on function public.wallet_unlike_network_post(uuid, uuid) from public, anon, authenticated;
revoke all on function public.wallet_follow_network_account(uuid, text) from public, anon, authenticated;
revoke all on function public.wallet_unfollow_network_account(uuid, text) from public, anon, authenticated;
revoke all on function public.wallet_create_owned_agent(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.bind_verified_human_wallet(text, text, text, text) to service_role;
grant execute on function public.wallet_create_network_post(uuid, text, uuid) to service_role;
grant execute on function public.wallet_like_network_post(uuid, uuid) to service_role;
grant execute on function public.wallet_unlike_network_post(uuid, uuid) to service_role;
grant execute on function public.wallet_follow_network_account(uuid, text) to service_role;
grant execute on function public.wallet_unfollow_network_account(uuid, text) to service_role;
grant execute on function public.wallet_create_owned_agent(uuid, text, text, text) to service_role;

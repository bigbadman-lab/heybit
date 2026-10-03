-- Social network foundation. Does not alter bit_runtime, processed_transactions,
-- bit_reactions, bit_rehearsal, or bit_agents.
-- Base tables are not readable by anon. Public views omit auth ids, keys, and callbacks.
-- Human writes go through auth.uid() functions. BIT publishing is service-role only.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text not null,
  account_type text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'ACTIVE',
  owner_account_id uuid,
  auth_user_id uuid,
  constraint accounts_username_key unique (username),
  constraint accounts_username_shape check (username ~ '^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$'),
  constraint accounts_display_name_length check (char_length(display_name) between 1 and 32),
  constraint accounts_bio_length check (bio is null or char_length(bio) between 1 and 160),
  constraint accounts_type_check check (account_type in ('HUMAN', 'AGENT')),
  constraint accounts_status_check check (status in ('ACTIVE')),
  constraint accounts_owner_not_self check (owner_account_id is null or owner_account_id <> id),
  constraint accounts_human_has_user check (
    account_type <> 'HUMAN' or auth_user_id is not null
  ),
  constraint accounts_agent_has_no_user check (
    account_type <> 'AGENT' or auth_user_id is null
  ),
  constraint accounts_owner_fk foreign key (owner_account_id) references public.accounts (id)
);

create unique index if not exists accounts_auth_user_idx
  on public.accounts (auth_user_id)
  where auth_user_id is not null;

create index if not exists accounts_owner_idx on public.accounts (owner_account_id);

create table if not exists public.agent_identities (
  account_id uuid primary key references public.accounts (id),
  verification_method text,
  public_key text,
  wallet_address text,
  callback_url text,
  runtime_status text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_identities_verification_check check (
    verification_method is null or verification_method in ('UNVERIFIED')
  ),
  constraint agent_identities_runtime_check check (
    runtime_status is null or runtime_status in ('ONLINE', 'THINKING', 'WORKING', 'IDLE', 'OFFLINE')
  ),
  constraint agent_identities_callback_check check (
    callback_url is null or callback_url ~ '^https://'
  )
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_account_id uuid not null references public.accounts (id),
  parent_post_id uuid references public.posts (id),
  body text not null,
  post_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_length check (char_length(btrim(body)) between 1 and 500),
  constraint posts_type_check check (post_type in ('POST', 'REACTION', 'SYSTEM')),
  constraint posts_parent_not_self check (parent_post_id is null or parent_post_id <> id)
);

create index if not exists posts_feed_idx
  on public.posts (created_at desc, id desc)
  where parent_post_id is null;

create index if not exists posts_parent_idx on public.posts (parent_post_id, created_at);
create index if not exists posts_author_idx on public.posts (author_account_id, created_at desc);

create table if not exists public.follows (
  follower_account_id uuid not null references public.accounts (id),
  following_account_id uuid not null references public.accounts (id),
  created_at timestamptz not null default now(),
  constraint follows_pair_key unique (follower_account_id, following_account_id),
  constraint follows_not_self check (follower_account_id <> following_account_id)
);

create index if not exists follows_following_idx on public.follows (following_account_id);
create index if not exists follows_follower_idx on public.follows (follower_account_id);

create table if not exists public.post_likes (
  account_id uuid not null references public.accounts (id),
  post_id uuid not null references public.posts (id),
  reaction_type text not null default 'LIKE',
  created_at timestamptz not null default now(),
  constraint post_likes_tuple_key unique (account_id, post_id, reaction_type),
  constraint post_likes_type_check check (reaction_type = 'LIKE')
);

create index if not exists post_likes_post_idx on public.post_likes (post_id);

create table if not exists public.bit_social_bridges (
  reaction_source_key text primary key,
  post_id uuid not null unique references public.posts (id),
  created_at timestamptz not null default now()
);

create or replace function public.set_social_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute function public.set_social_updated_at();

drop trigger if exists agent_identities_set_updated_at on public.agent_identities;
create trigger agent_identities_set_updated_at
before update on public.agent_identities
for each row
execute function public.set_social_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row
execute function public.set_social_updated_at();

create or replace function public.reject_reserved_username()
returns trigger
language plpgsql
as $$
begin
  if new.username = 'bit'
    and new.account_type = 'AGENT'
    and new.auth_user_id is null
    and new.owner_account_id is null then
    return new;
  end if;
  if new.username in (
    'bit', 'admin', 'heybit', 'system', 'api', 'join', 'network', 'www',
    'auth', 'create', 'agents', 'agent', 'lab'
  ) then
    raise exception 'reserved_username';
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_reject_reserved_username on public.accounts;
create trigger accounts_reject_reserved_username
before insert or update of username, account_type, auth_user_id, owner_account_id
on public.accounts
for each row
execute function public.reject_reserved_username();

insert into public.accounts (username, display_name, account_type, bio, status)
values ('bit', 'BIT', 'AGENT', 'i watch what happens around here.', 'ACTIVE')
on conflict (username) do nothing;

insert into public.agent_identities (account_id)
select id from public.accounts where username = 'bit'
on conflict (account_id) do nothing;

create or replace view public.network_profiles
with (security_invoker = false) as
select
  a.id,
  a.username,
  a.display_name,
  a.account_type,
  a.bio,
  a.avatar_url,
  a.created_at,
  i.runtime_status,
  owner.username as owner_username,
  (select count(*) from public.follows f where f.following_account_id = a.id) as follower_count,
  (select count(*) from public.follows f where f.follower_account_id = a.id) as following_count
from public.accounts a
left join public.agent_identities i on i.account_id = a.id
left join public.accounts owner on owner.id = a.owner_account_id
where a.status = 'ACTIVE';

create or replace view public.network_posts
with (security_invoker = false) as
select
  p.id,
  p.parent_post_id,
  p.body,
  p.post_type,
  p.created_at,
  a.username,
  a.display_name,
  a.account_type,
  i.runtime_status,
  (select count(*) from public.posts r where r.parent_post_id = p.id) as reply_count,
  (select count(*) from public.post_likes l where l.post_id = p.id and l.reaction_type = 'LIKE') as like_count
from public.posts p
join public.accounts a on a.id = p.author_account_id
left join public.agent_identities i on i.account_id = a.id
where a.status = 'ACTIVE';

comment on view public.network_profiles is
  'Public social profiles. No auth ids, keys, wallets, or callback URLs.';

comment on view public.network_posts is
  'Public posts and counts. No author auth ids.';

alter table public.accounts enable row level security;
alter table public.agent_identities enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.post_likes enable row level security;
alter table public.bit_social_bridges enable row level security;

revoke all on table public.accounts from public, anon, authenticated;
revoke all on table public.agent_identities from public, anon, authenticated;
revoke all on table public.posts from public, anon, authenticated;
revoke all on table public.follows from public, anon, authenticated;
revoke all on table public.post_likes from public, anon, authenticated;
revoke all on table public.bit_social_bridges from public, anon, authenticated;

revoke all on table public.network_profiles from public, anon, authenticated;
revoke all on table public.network_posts from public, anon, authenticated;
grant select on table public.network_profiles to anon, authenticated;
grant select on table public.network_posts to anon, authenticated;

create or replace function public.current_network_account()
returns table (
  id uuid,
  username text,
  display_name text,
  account_type text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.username, a.display_name, a.account_type
  from public.accounts a
  where a.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.liked_post_ids(p_ids uuid[])
returns table (post_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select l.post_id
  from public.post_likes l
  where l.reaction_type = 'LIKE'
    and l.post_id = any (p_ids)
    and l.account_id in (
      select a.id from public.accounts a where a.auth_user_id = auth.uid()
    );
$$;

create or replace function public.viewer_follows(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.follows f
    join public.accounts follower on follower.id = f.follower_account_id
    join public.accounts following on following.id = f.following_account_id
    where follower.auth_user_id = auth.uid()
      and following.username = lower(btrim(p_username))
  );
$$;

create or replace function public.complete_human_profile(
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
  v_user uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display text := btrim(coalesce(p_display_name, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_id uuid;
  v_existing text;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;
  select a.id, a.username into v_id, v_existing
  from public.accounts a
  where a.auth_user_id = v_user;
  if found then
    return jsonb_build_object('id', v_id, 'username', v_existing, 'created', false);
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
  insert into public.accounts (username, display_name, account_type, bio, status, auth_user_id)
  values (v_username, v_display, 'HUMAN', v_bio, 'ACTIVE', v_user)
  returning id, username into v_id, v_existing;
  return jsonb_build_object('id', v_id, 'username', v_existing, 'created', true);
exception
  when unique_violation then
    select a.id, a.username into v_id, v_existing
    from public.accounts a
    where a.auth_user_id = v_user;
    if found then
      return jsonb_build_object('id', v_id, 'username', v_existing, 'created', false);
    end if;
    raise exception 'username_taken';
end;
$$;

create or replace function public.create_owned_agent(
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
  v_user uuid := auth.uid();
  v_owner uuid;
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display text := btrim(coalesce(p_display_name, ''));
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_id uuid;
  v_count integer;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;
  select a.id into v_owner
  from public.accounts a
  where a.auth_user_id = v_user
    and a.account_type = 'HUMAN';
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

create or replace function public.create_network_post(p_body text, p_parent uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_author uuid;
  v_username text;
  v_type text;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;
  select a.id, a.username, a.account_type into v_author, v_username, v_type
  from public.accounts a
  where a.auth_user_id = v_user
    and a.status = 'ACTIVE';
  if v_author is null then
    raise exception 'needs_profile';
  end if;
  if v_type <> 'HUMAN' or v_username = 'bit' then
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

create or replace function public.like_network_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  select a.id into v_account from public.accounts a where a.auth_user_id = auth.uid();
  if v_account is null then
    raise exception 'needs_profile';
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

create or replace function public.unlike_network_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  select a.id into v_account from public.accounts a where a.auth_user_id = auth.uid();
  if v_account is null then
    raise exception 'needs_profile';
  end if;
  delete from public.post_likes
  where account_id = v_account
    and post_id = p_post_id
    and reaction_type = 'LIKE';
  return false;
end;
$$;

create or replace function public.follow_network_account(p_username text)
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
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  select a.id into v_follower from public.accounts a where a.auth_user_id = auth.uid();
  if v_follower is null then
    raise exception 'needs_profile';
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

create or replace function public.unfollow_network_account(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower uuid;
  v_name text := lower(btrim(coalesce(p_username, '')));
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  select a.id into v_follower from public.accounts a where a.auth_user_id = auth.uid();
  if v_follower is null then
    raise exception 'needs_profile';
  end if;
  delete from public.follows f
  using public.accounts following
  where f.follower_account_id = v_follower
    and f.following_account_id = following.id
    and following.username = v_name;
end;
$$;

create or replace function public.publish_bit_reaction(p_source_key text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_bit uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_post uuid;
begin
  if p_source_key is null or btrim(p_source_key) = '' then
    raise exception 'invalid_source';
  end if;
  select b.post_id into v_existing
  from public.bit_social_bridges b
  where b.reaction_source_key = p_source_key;
  if v_existing is not null then
    return v_existing;
  end if;
  if v_body = '' or char_length(v_body) > 500 then
    raise exception 'invalid_body';
  end if;
  select a.id into v_bit from public.accounts a where a.username = 'bit' and a.account_type = 'AGENT';
  if v_bit is null then
    raise exception 'bit_missing';
  end if;
  insert into public.posts (author_account_id, body, post_type, metadata)
  values (
    v_bit,
    v_body,
    'REACTION',
    jsonb_build_object('source', 'bit_reaction', 'source_key', p_source_key)
  )
  returning id into v_post;
  insert into public.bit_social_bridges (reaction_source_key, post_id)
  values (p_source_key, v_post);
  return v_post;
exception
  when unique_violation then
    select b.post_id into v_existing
    from public.bit_social_bridges b
    where b.reaction_source_key = p_source_key;
    if v_existing is not null then
      return v_existing;
    end if;
    raise;
end;
$$;

revoke all on function public.current_network_account() from public, anon;
revoke all on function public.liked_post_ids(uuid[]) from public, anon;
revoke all on function public.viewer_follows(text) from public, anon;
revoke all on function public.complete_human_profile(text, text, text) from public, anon;
revoke all on function public.create_owned_agent(text, text, text) from public, anon;
revoke all on function public.create_network_post(text, uuid) from public, anon;
revoke all on function public.like_network_post(uuid) from public, anon;
revoke all on function public.unlike_network_post(uuid) from public, anon;
revoke all on function public.follow_network_account(text) from public, anon;
revoke all on function public.unfollow_network_account(text) from public, anon;
revoke all on function public.publish_bit_reaction(text, text) from public, anon, authenticated;

grant execute on function public.current_network_account() to authenticated;
grant execute on function public.liked_post_ids(uuid[]) to authenticated;
grant execute on function public.viewer_follows(text) to authenticated;
grant execute on function public.complete_human_profile(text, text, text) to authenticated;
grant execute on function public.create_owned_agent(text, text, text) to authenticated;
grant execute on function public.create_network_post(text, uuid) to authenticated;
grant execute on function public.like_network_post(uuid) to authenticated;
grant execute on function public.unlike_network_post(uuid) to authenticated;
grant execute on function public.follow_network_account(text) to authenticated;
grant execute on function public.unfollow_network_account(text) to authenticated;
grant execute on function public.publish_bit_reaction(text, text) to service_role;

-- Public speech line for the homepage.
-- Does not alter bit_runtime or processed_transactions.
-- Does not grant writes. Exposes generated text only.

create or replace view public.bit_public_speech
with (security_invoker = false) as
select text, generated_at
from public.bit_reactions
where status = 'GENERATED'
  and text is not null
order by generated_at desc nulls last
limit 1;

comment on view public.bit_public_speech is
  'Latest generated BIT line. Select only. No prompts, models, or source keys.';

revoke all on table public.bit_public_speech from public, anon, authenticated;
grant select on table public.bit_public_speech to anon, authenticated;

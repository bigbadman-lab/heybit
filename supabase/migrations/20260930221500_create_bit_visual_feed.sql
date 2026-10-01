-- Read-only visual cues for the homepage mascot.
-- Does not alter bit_runtime, processed_transactions, or bit_reactions.
-- Does not grant writes. Does not expose amounts, prompts, or reaction text.

create or replace view public.bit_visual_feed
with (security_invoker = false) as
select
  signature as cue_id,
  event_type as kind,
  observed_at
from public.processed_transactions
where status = 'trade'
  and event_type in ('BUY', 'SELL')
union all
select
  source_key as cue_id,
  case reaction_type
    when 'TOKEN_BURN' then 'BURN'
    else 'DEX_PAID'
  end as kind,
  coalesce(generated_at, created_at) as observed_at
from public.bit_reactions
where reaction_type in ('TOKEN_BURN', 'DEX_PAID')
  and status = 'GENERATED';

comment on view public.bit_visual_feed is
  'Narrow read model for BIT visual reactions. Select only. No amounts and no generated text.';

revoke all on table public.bit_visual_feed from public;
grant select on table public.bit_visual_feed to anon, authenticated;

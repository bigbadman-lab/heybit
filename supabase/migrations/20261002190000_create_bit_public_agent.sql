-- Bounded public reads for BIT's short-term state.
-- Does not alter bit_runtime, processed_transactions, or bit_reactions.
-- No signatures, prompts, models, or source keys.

create or replace view public.bit_public_agent_trades
with (security_invoker = false) as
select event_type, sol_amount, observed_at
from public.processed_transactions
where status = 'trade'
  and event_type in ('BUY', 'SELL')
  and observed_at > now() - interval '15 minutes'
order by observed_at desc
limit 200;

create or replace view public.bit_public_lines
with (security_invoker = false) as
select text, generated_at
from public.bit_reactions
where status = 'GENERATED'
  and text is not null
order by generated_at desc
limit 5;

create or replace view public.bit_public_thinking
with (security_invoker = false) as
select exists (
  select 1
  from public.bit_reactions
  where status = 'PENDING'
    and created_at > now() - interval '45 seconds'
) as thinking;

comment on view public.bit_public_agent_trades is
  'Recent trade totals for the public agent. Select only. No signatures.';

comment on view public.bit_public_lines is
  'Last five generated BIT lines. Select only. No prompts or source keys.';

comment on view public.bit_public_thinking is
  'Whether a reaction is currently pending. No text.';

revoke all on table public.bit_public_agent_trades from public, anon, authenticated;
revoke all on table public.bit_public_lines from public, anon, authenticated;
revoke all on table public.bit_public_thinking from public, anon, authenticated;
grant select on table public.bit_public_agent_trades to anon, authenticated;
grant select on table public.bit_public_lines to anon, authenticated;
grant select on table public.bit_public_thinking to anon, authenticated;

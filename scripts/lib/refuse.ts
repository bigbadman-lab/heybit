export const BIT_BURN_MESSAGE = `BLOCKED

BIT burn tooling is not implemented or authorized in Phase 1.
No Solana transaction was created.
No writes were performed.
`;

export const BIT_DEX_PAID_MESSAGE = `BLOCKED

DEX-paid event recording is not implemented or authorized in Phase 1.
No production state was changed.
`;

export function refuse(message: string): number {
  process.stdout.write(message.endsWith("\n") ? message : `${message}\n`);
  return 1;
}

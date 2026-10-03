export async function disconnectActiveWallet(): Promise<void> {
  const { ConnectionController } = await import("@reown/appkit-controllers");
  await ConnectionController.disconnect();
}

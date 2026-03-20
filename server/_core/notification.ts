// Notification stub - not used in standalone deployment
export type NotificationPayload = { title: string; content: string; };

export async function notifyOwner(_payload: NotificationPayload): Promise<boolean> {
  console.log("[Notification] notifyOwner not configured in standalone mode");
  return false;
}

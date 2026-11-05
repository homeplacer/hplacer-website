/** Email delivery for newly assigned tasks. Disabled until deliberately configured. */
import {
  dispatchNotificationOutbox,
  NotificationDeliveryError,
  type NotificationDeliveryMessage,
  type NotificationDispatcher,
} from "../domain/notification-delivery.ts";
import type { PortalEnv } from "../platform/types.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface TaskEmailRunSummary {
  enabled: boolean;
  sent: number;
  retried: number;
  failed: number;
}

export class ResendTaskNotificationDispatcher implements NotificationDispatcher {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    from: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.from = from;
    this.fetcher = fetcher;
  }

  async send(message: NotificationDeliveryMessage): Promise<void> {
    const lines = [message.body];
    if (message.taskUrl) lines.push("", `Open the task: ${message.taskUrl}`);
    const subjectTitle = message.title.replace(/[\r\n]+/g, " ").slice(0, 180);
    const response = await this.fetcher(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.id,
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.recipientEmail],
        subject: `Home Placer task assigned: ${subjectTitle}`,
        text: lines.join("\n"),
      }),
    });

    if (!response.ok) {
      // Do not retain the provider body: it can include recipient or account data.
      const retryable = response.status >= 500 || response.status === 408 || response.status === 409 || response.status === 429;
      throw new NotificationDeliveryError(`Email provider returned HTTP ${response.status}`, retryable);
    }
  }
}

/**
 * Sends only recent task-assignment alerts. A required start-after watermark
 * prevents old in-portal alerts from being emailed when this feature is first
 * enabled. No-op unless every setting is present and the explicit flag is on.
 */
export async function runTaskAssignmentEmail(env: PortalEnv, fetcher: typeof fetch = fetch): Promise<TaskEmailRunSummary> {
  if (env.TASK_EMAIL_NOTIFICATIONS_ENABLED !== "true" || !env.PORTAL_DB) {
    return { enabled: false, sent: 0, retried: 0, failed: 0 };
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.TASK_NOTIFICATION_FROM?.trim();
  const startAfter = env.TASK_EMAIL_START_AFTER?.trim();
  if (!apiKey || !from || !startAfter || !Number.isFinite(Date.parse(startAfter))) {
    return { enabled: false, sent: 0, retried: 0, failed: 0 };
  }

  const result = await dispatchNotificationOutbox(
    env.PORTAL_DB,
    new ResendTaskNotificationDispatcher(apiKey, from, fetcher),
    { categories: ["task_assigned"], createdAfter: new Date(startAfter).toISOString(), emailEligibleOnly: true, limit: 50 },
  );
  return { enabled: true, ...result };
}

/**
 * Webhook Provider Interface
 */

export interface WebhookOptions {
  url: string;
  payload: unknown;
}

export interface WebhookResult {
  statusCode: number;
}

export class WebhookProvider {
  async sendWebhook(_options: WebhookOptions): Promise<WebhookResult> {
    // Mock implementation - in production would use axios or fetch
    return { statusCode: 200 };
  }
}

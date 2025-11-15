/**
 * Email Provider Interface
 */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  data?: Record<string, unknown>;
  text?: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    type?: string;
  }>;
  trackOpens?: boolean;
  trackClicks?: boolean;
  sendAt?: Date;
}

export interface EmailResult {
  messageId: string;
  success: boolean;
}

export interface EmailConfig {
  apiKey: string;
  from: {
    email: string;
    name: string;
  };
}

export interface TemplateEmailOptions {
  to: string;
  templateId: string;
  data?: Record<string, unknown>;
  dynamicData?: Record<string, unknown>; // Alias for data
}

export interface EmailStats {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  opens: number; // Alias for opened
  clicks: number; // Alias for clicked
}

export interface BounceInfo {
  email: string;
  reason: string;
  timestamp: string;
}

export interface WebhookEvent {
  event: string;
  email: string;
  timestamp: string;
  [key: string]: unknown;
}

export class EmailProvider {
  private config?: EmailConfig;

  constructor(config?: EmailConfig) {
    this.config = config;
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    // Validate email
    const to = Array.isArray(options.to) ? options.to[0] : options.to;
    if (!this.validateEmail(to)) {
      throw new Error('Invalid email address');
    }

    // Mock implementation - in production would use nodemailer or similar
    return {
      messageId: `email-${Date.now()}`,
      success: true,
    };
  }

  async sendTemplateEmail(options: TemplateEmailOptions): Promise<EmailResult> {
    return {
      messageId: `template-email-${Date.now()}`,
      success: true,
    };
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async verifyEmailDeliverability(email: string): Promise<{
    valid: boolean;
    deliverable: boolean;
    disposable: boolean;
    reason?: string;
  }> {
    const valid = this.validateEmail(email);
    return {
      valid,
      deliverable: valid,
      disposable: false,
      reason: valid ? undefined : 'Invalid email format',
    };
  }

  async getEmailStats(_startDate: string, _endDate: string): Promise<EmailStats> {
    return {
      sent: 100,
      delivered: 95,
      bounced: 5,
      opened: 70,
      clicked: 30,
      opens: 450,
      clicks: 120,
    };
  }

  async handleWebhook(event: WebhookEvent): Promise<{ processed: boolean; action?: string }> {
    let action: string | undefined;

    if (event.event === 'bounce') {
      action = 'suppress_email';
    } else if (event.event === 'complaint') {
      action = 'unsubscribe_and_suppress';
    }

    return { processed: true, action };
  }

  async validateDomainAuth(domain: string): Promise<{ valid: boolean; spf: boolean; dkim: boolean; dmarc: boolean }> {
    return {
      valid: true,
      spf: true,
      dkim: true,
      dmarc: true,
    };
  }

  async getBounces(): Promise<BounceInfo[]> {
    return [];
  }

  async removeBounce(email: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  async suppressEmail(email: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  async isEmailSuppressed(email: string): Promise<boolean> {
    return false;
  }

  async sendBulkEmails(emails: EmailOptions[]): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    return {
      success: true,
      sent: emails.length,
      failed: 0,
    };
  }

  async cancelScheduledEmail(messageId: string): Promise<{ success: boolean }> {
    return { success: true };
  }
}

// Alias for compatibility
export { EmailProvider as EmailServiceProvider };

/**
 * SMS Provider Interface
 */

export interface SMSOptions {
  to: string;
  message: string;
}

export interface SMSResult {
  messageId: string;
}

export class SMSProvider {
  async sendSMS(_options: SMSOptions): Promise<SMSResult> {
    // Mock implementation - in production would use Twilio or similar
    return { messageId: `sms-${Date.now()}` };
  }
}

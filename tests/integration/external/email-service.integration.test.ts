/**
 * Integration Tests: Email Service Provider
 *
 * Testing integration with email delivery services (SendGrid, Mailgun, SES)
 */

import axios from 'axios';
import { EmailServiceProvider } from '../../../src/services/notifications/providers/email.provider';
import { BadRequestError, ServiceUnavailableError } from '../../../src/libs/errors';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Email Service Integration Tests', () => {
  let emailService: EmailServiceProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService = new EmailServiceProvider({
      apiKey: 'test-sendgrid-api-key',
      from: {
        email: 'noreply@example.com',
        name: 'E-commerce Platform',
      },
    });
  });

  describe('Send Transactional Emails', () => {
    it('should send simple email', async () => {
      const email = {
        to: 'customer@test.com',
        subject: 'Order Confirmation',
        text: 'Your order has been confirmed.',
        html: '<p>Your order has been confirmed.</p>',
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: {
          success: true,
          messageId: 'msg_abc123',
        },
      });

      const result = await emailService.sendEmail(email);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_abc123');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          personalizations: expect.arrayContaining([
            expect.objectContaining({
              to: expect.arrayContaining([
                expect.objectContaining({ email: 'customer@test.com' }),
              ]),
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('should send email with attachments', async () => {
      const email = {
        to: 'customer@test.com',
        subject: 'Your Invoice',
        text: 'Please find your invoice attached.',
        attachments: [
          {
            filename: 'invoice.pdf',
            content: 'base64-encoded-pdf-content',
            type: 'application/pdf',
          },
        ],
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: {
          success: true,
          messageId: 'msg_with_attachment',
        },
      });

      const result = await emailService.sendEmail(email);

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'invoice.pdf',
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('should send email to multiple recipients', async () => {
      const email = {
        to: ['user1@test.com', 'user2@test.com', 'user3@test.com'],
        subject: 'Team Update',
        text: 'Important team announcement',
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: {
          success: true,
          messageId: 'msg_multi_recipient',
        },
      });

      const result = await emailService.sendEmail(email);

      expect(result.success).toBe(true);
    });

    it('should include CC and BCC recipients', async () => {
      const email = {
        to: 'primary@test.com',
        cc: ['manager@test.com'],
        bcc: ['audit@test.com'],
        subject: 'Important Notice',
        text: 'This is an important notice',
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: { success: true },
      });

      await emailService.sendEmail(email);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          personalizations: expect.arrayContaining([
            expect.objectContaining({
              cc: expect.any(Array),
              bcc: expect.any(Array),
            }),
          ]),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Template-Based Emails', () => {
    it('should send email using template', async () => {
      const templateEmail = {
        to: 'customer@test.com',
        templateId: 'welcome-email-template',
        dynamicData: {
          firstName: 'John',
          verificationLink: 'https://example.com/verify/abc123',
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: {
          success: true,
          messageId: 'msg_template_123',
        },
      });

      const result = await emailService.sendTemplateEmail(templateEmail);

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          template_id: 'welcome-email-template',
          personalizations: expect.arrayContaining([
            expect.objectContaining({
              dynamic_template_data: expect.objectContaining({
                firstName: 'John',
              }),
            }),
          ]),
        }),
        expect.any(Object)
      );
    });

    it('should send order confirmation with template', async () => {
      const orderEmail = {
        to: 'buyer@test.com',
        templateId: 'order-confirmation',
        dynamicData: {
          orderNumber: 'ORD-2024-001',
          items: [
            { name: 'Product 1', quantity: 2, price: 50.00 },
            { name: 'Product 2', quantity: 1, price: 75.00 },
          ],
          total: 175.00,
          trackingUrl: 'https://example.com/track/xyz',
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: { success: true },
      });

      await emailService.sendTemplateEmail(orderEmail);

      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('Email Validation', () => {
    it('should validate email address format', async () => {
      expect(emailService.validateEmail('valid@example.com')).toBe(true);
      expect(emailService.validateEmail('user+tag@example.co.uk')).toBe(true);
      expect(emailService.validateEmail('invalid-email')).toBe(false);
      expect(emailService.validateEmail('missing@')).toBe(false);
      expect(emailService.validateEmail('@nodomain.com')).toBe(false);
    });

    it('should reject email to invalid address', async () => {
      const email = {
        to: 'invalid-email-format',
        subject: 'Test',
        text: 'Test message',
      };

      await expect(emailService.sendEmail(email)).rejects.toThrow(BadRequestError);
    });

    it('should verify email deliverability', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          valid: true,
          disposable: false,
          roleAddress: false,
          score: 0.95,
        },
      });

      const verification = await emailService.verifyEmailDeliverability(
        'customer@gmail.com'
      );

      expect(verification.valid).toBe(true);
      expect(verification.disposable).toBe(false);
    });

    it('should detect disposable email addresses', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          valid: true,
          disposable: true,
          provider: 'tempmail.com',
        },
      });

      const verification = await emailService.verifyEmailDeliverability(
        'user@tempmail.com'
      );

      expect(verification.disposable).toBe(true);
    });
  });

  describe('Email Tracking', () => {
    it('should enable open tracking', async () => {
      const email = {
        to: 'customer@test.com',
        subject: 'Newsletter',
        html: '<p>Welcome to our newsletter</p>',
        trackOpens: true,
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: { success: true },
      });

      await emailService.sendEmail(email);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tracking_settings: expect.objectContaining({
            open_tracking: expect.objectContaining({
              enable: true,
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it('should enable click tracking', async () => {
      const email = {
        to: 'customer@test.com',
        subject: 'Check out our new products',
        html: '<p>Click <a href="https://example.com/products">here</a></p>',
        trackClicks: true,
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: { success: true },
      });

      await emailService.sendEmail(email);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tracking_settings: expect.objectContaining({
            click_tracking: expect.objectContaining({
              enable: true,
            }),
          }),
        }),
        expect.any(Object)
      );
    });

    it('should retrieve email statistics', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          stats: [
            {
              date: '2024-01-15',
              delivered: 1000,
              opens: 450,
              clicks: 120,
              bounces: 5,
              complaints: 1,
            },
          ],
        },
      });

      const stats = await emailService.getEmailStats('2024-01-15', '2024-01-15');

      expect(stats.delivered).toBe(1000);
      expect(stats.opens).toBe(450);
      expect(stats.clicks).toBe(120);
    });
  });

  describe('Bounce and Complaint Handling', () => {
    it('should process bounce webhook', async () => {
      const bounceEvent = {
        event: 'bounce',
        email: 'bounced@example.com',
        reason: 'mailbox_full',
        timestamp: new Date().toISOString(),
      };

      const result = await emailService.handleWebhook(bounceEvent);

      expect(result.processed).toBe(true);
      expect(result.action).toBe('suppress_email');
    });

    it('should process spam complaint webhook', async () => {
      const complaintEvent = {
        event: 'spamreport',
        email: 'complainer@example.com',
        timestamp: new Date().toISOString(),
      };

      const result = await emailService.handleWebhook(complaintEvent);

      expect(result.processed).toBe(true);
      expect(result.action).toBe('unsubscribe_and_suppress');
    });

    it('should retrieve bounce list', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          bounces: [
            {
              email: 'bounced1@example.com',
              reason: 'invalid_address',
              created: 1705320000,
            },
            {
              email: 'bounced2@example.com',
              reason: 'mailbox_full',
              created: 1705406400,
            },
          ],
        },
      });

      const bounces = await emailService.getBounces();

      expect(bounces.length).toBe(2);
    });

    it('should remove email from bounce list', async () => {
      mockedAxios.delete.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      const result = await emailService.removeBounce('recovered@example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('Suppression Lists', () => {
    it('should add email to suppression list', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 201,
        data: { success: true },
      });

      const result = await emailService.suppressEmail('unsubscribed@example.com');

      expect(result.success).toBe(true);
    });

    it('should check if email is suppressed', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          suppressed: true,
          reason: 'unsubscribe',
        },
      });

      const isSuppressed = await emailService.isEmailSuppressed(
        'unsubscribed@example.com'
      );

      expect(isSuppressed).toBe(true);
    });

    it('should not send email to suppressed address', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { suppressed: true },
      });

      const email = {
        to: 'suppressed@example.com',
        subject: 'Test',
        text: 'Test',
      };

      await expect(emailService.sendEmail(email)).rejects.toThrow(
        'Email address is suppressed'
      );
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should handle rate limit errors', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 429,
          data: {
            error: 'rate_limit_exceeded',
            retry_after: 60,
          },
        },
      });

      await expect(
        emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test',
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('should batch emails for bulk sending', async () => {
      const emails = Array.from({ length: 100 }, (_, i) => ({
        to: `user${i}@example.com`,
        subject: 'Bulk Email',
        text: 'This is a bulk email',
      }));

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: { success: true },
      });

      const results = await emailService.sendBulkEmails(emails);

      expect(results.sent).toBe(100);
      // Should batch into groups of 1000
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Email Scheduling', () => {
    it('should schedule email for future delivery', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      const email = {
        to: 'customer@test.com',
        subject: 'Scheduled Email',
        text: 'This email was scheduled',
        sendAt: futureDate,
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: {
          success: true,
          messageId: 'msg_scheduled',
          scheduledFor: futureDate.toISOString(),
        },
      });

      const result = await emailService.sendEmail(email);

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          send_at: expect.any(Number),
        }),
        expect.any(Object)
      );
    });

    it('should cancel scheduled email', async () => {
      mockedAxios.delete.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      const result = await emailService.cancelScheduledEmail('msg_scheduled');

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 401,
          data: {
            error: 'unauthorized',
            message: 'Invalid API key',
          },
        },
      });

      await expect(
        emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should handle service unavailable errors', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 503,
          data: {
            error: 'service_unavailable',
          },
        },
      });

      await expect(
        emailService.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Test',
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('should retry on transient failures', async () => {
      mockedAxios.post
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValueOnce({
          status: 202,
          data: { success: true },
        });

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });
  });

  describe('Custom Headers and Metadata', () => {
    it('should include custom headers', async () => {
      const email = {
        to: 'customer@test.com',
        subject: 'Test',
        text: 'Test',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Order-ID': 'ORD-123',
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: { success: true },
      });

      await emailService.sendEmail(email);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should include custom metadata', async () => {
      const email = {
        to: 'customer@test.com',
        subject: 'Test',
        text: 'Test',
        metadata: {
          userId: 'user-123',
          orderId: 'order-456',
          campaign: 'summer-sale',
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 202,
        data: { success: true },
      });

      await emailService.sendEmail(email);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          custom_args: expect.objectContaining({
            userId: 'user-123',
            orderId: 'order-456',
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('DKIM and SPF Validation', () => {
    it('should validate domain authentication', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          domain: 'example.com',
          dkim: {
            valid: true,
            selector: 'default',
          },
          spf: {
            valid: true,
          },
        },
      });

      const validation = await emailService.validateDomainAuth('example.com');

      expect(validation.dkim.valid).toBe(true);
      expect(validation.spf.valid).toBe(true);
    });
  });
});

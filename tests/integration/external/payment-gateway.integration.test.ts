/**
 * Integration Tests: Payment Gateway API
 *
 * Testing integration with external payment processing services
 */

import axios from 'axios';
import { PaymentGatewayService } from '../../../src/services/order-processing/services/payment-gateway.service';
import { BadRequestError, ServiceUnavailableError } from '../../../src/libs/errors';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Payment Gateway Integration Tests', () => {
  let paymentGateway: PaymentGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentGateway = new PaymentGatewayService({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      endpoint: 'https://api.payment-gateway.com',
    });
  });

  describe('Process Credit Card Payment', () => {
    it('should successfully process credit card payment', async () => {
      const paymentData = {
        amount: 100.00,
        currency: 'USD',
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'John Doe',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          transactionId: 'txn_abc123456',
          status: 'approved',
          amount: 100.00,
          currency: 'USD',
        },
      });

      const result = await paymentGateway.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn_abc123456');
      expect(result.status).toBe('approved');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.payment-gateway.com/v1/payments',
        expect.objectContaining({
          amount: 100.00,
          currency: 'USD',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle declined credit card', async () => {
      const paymentData = {
        amount: 50.00,
        currency: 'USD',
        cardNumber: '4000000000000002', // Test card that triggers decline
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'Jane Doe',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: false,
          status: 'declined',
          errorCode: 'card_declined',
          errorMessage: 'Your card was declined',
        },
      });

      const result = await paymentGateway.processPayment(paymentData);

      expect(result.success).toBe(false);
      expect(result.status).toBe('declined');
      expect(result.errorMessage).toContain('declined');
    });

    it('should handle insufficient funds', async () => {
      const paymentData = {
        amount: 1000.00,
        currency: 'USD',
        cardNumber: '4000000000000341', // Test card for insufficient funds
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'Poor Customer',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: false,
          status: 'declined',
          errorCode: 'insufficient_funds',
          errorMessage: 'Insufficient funds',
        },
      });

      const result = await paymentGateway.processPayment(paymentData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('insufficient_funds');
    });

    it('should validate card expiry date', async () => {
      const paymentData = {
        amount: 75.00,
        currency: 'USD',
        cardNumber: '4111111111111111',
        expiryMonth: '01',
        expiryYear: '2020', // Expired
        cvv: '123',
        cardholderName: 'Expired Card',
      };

      await expect(paymentGateway.processPayment(paymentData)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('Payment Refund Operations', () => {
    it('should process full refund', async () => {
      const refundData = {
        transactionId: 'txn_original_123',
        amount: 100.00,
        reason: 'Customer request',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          refundId: 'rfnd_xyz789',
          status: 'completed',
          amount: 100.00,
          originalTransactionId: 'txn_original_123',
        },
      });

      const result = await paymentGateway.refundPayment(refundData);

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('rfnd_xyz789');
      expect(result.status).toBe('completed');
    });

    it('should process partial refund', async () => {
      const refundData = {
        transactionId: 'txn_original_456',
        amount: 25.00, // Original was 100.00
        reason: 'Partial refund',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          refundId: 'rfnd_partial_123',
          status: 'completed',
          amount: 25.00,
        },
      });

      const result = await paymentGateway.refundPayment(refundData);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(25.00);
    });

    it('should reject refund for already refunded transaction', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'transaction_already_refunded',
            message: 'This transaction has already been refunded',
          },
        },
      });

      await expect(
        paymentGateway.refundPayment({
          transactionId: 'txn_already_refunded',
          amount: 50.00,
        })
      ).rejects.toThrow();
    });
  });

  describe('Payment Gateway Webhooks', () => {
    it('should verify webhook signature', () => {
      const payload = {
        event: 'payment.success',
        transactionId: 'txn_webhook_123',
        amount: 150.00,
      };

      const signature = paymentGateway.generateWebhookSignature(payload);

      expect(
        paymentGateway.verifyWebhookSignature(payload, signature)
      ).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = {
        event: 'payment.success',
        transactionId: 'txn_fake',
      };

      const invalidSignature = 'invalid_signature_12345';

      expect(
        paymentGateway.verifyWebhookSignature(payload, invalidSignature)
      ).toBe(false);
    });

    it('should process payment success webhook', async () => {
      const webhookPayload = {
        event: 'payment.succeeded',
        data: {
          transactionId: 'txn_webhook_success',
          status: 'completed',
          amount: 200.00,
          currency: 'USD',
        },
      };

      const result = await paymentGateway.handleWebhook(webhookPayload);

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment.succeeded');
    });

    it('should process payment failure webhook', async () => {
      const webhookPayload = {
        event: 'payment.failed',
        data: {
          transactionId: 'txn_webhook_failed',
          status: 'failed',
          errorCode: 'card_declined',
        },
      };

      const result = await paymentGateway.handleWebhook(webhookPayload);

      expect(result.processed).toBe(true);
      expect(result.event).toBe('payment.failed');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry on network timeout', async () => {
      mockedAxios.post
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            success: true,
            transactionId: 'txn_retry_success',
          },
        });

      const result = await paymentGateway.processPayment({
        amount: 100.00,
        currency: 'USD',
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'Retry Test',
      });

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockedAxios.post.mockRejectedValue({ code: 'ETIMEDOUT' });

      await expect(
        paymentGateway.processPayment({
          amount: 100.00,
          currency: 'USD',
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
          cardholderName: 'Max Retry Test',
        })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('should handle API rate limiting', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 429,
          headers: {
            'retry-after': '5',
          },
          data: {
            error: 'rate_limit_exceeded',
          },
        },
      });

      await expect(
        paymentGateway.processPayment({
          amount: 100.00,
          currency: 'USD',
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
          cardholderName: 'Rate Limit Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('Payment Method Validation', () => {
    it('should validate credit card number using Luhn algorithm', () => {
      expect(paymentGateway.validateCardNumber('4111111111111111')).toBe(true); // Valid Visa
      expect(paymentGateway.validateCardNumber('5555555555554444')).toBe(true); // Valid Mastercard
      expect(paymentGateway.validateCardNumber('1234567890123456')).toBe(false); // Invalid
    });

    it('should identify card type from number', () => {
      expect(paymentGateway.getCardType('4111111111111111')).toBe('visa');
      expect(paymentGateway.getCardType('5555555555554444')).toBe('mastercard');
      expect(paymentGateway.getCardType('378282246310005')).toBe('amex');
    });

    it('should validate CVV format', () => {
      expect(paymentGateway.validateCVV('123', 'visa')).toBe(true);
      expect(paymentGateway.validateCVV('1234', 'amex')).toBe(true);
      expect(paymentGateway.validateCVV('12', 'visa')).toBe(false);
      expect(paymentGateway.validateCVV('123', 'amex')).toBe(false);
    });
  });

  describe('Currency and Amount Handling', () => {
    it('should process payment in different currencies', async () => {
      const currencies = ['USD', 'EUR', 'GBP', 'JPY'];

      for (const currency of currencies) {
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: {
            success: true,
            transactionId: `txn_${currency}_123`,
            currency,
          },
        });

        const result = await paymentGateway.processPayment({
          amount: 100.00,
          currency,
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
          cardholderName: 'Multi Currency Test',
        });

        expect(result.success).toBe(true);
        expect(result.currency).toBe(currency);
      }
    });

    it('should validate minimum payment amount', async () => {
      await expect(
        paymentGateway.processPayment({
          amount: 0.49, // Below $0.50 minimum
          currency: 'USD',
          cardNumber: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
          cardholderName: 'Min Amount Test',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should handle large payment amounts', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          transactionId: 'txn_large_amount',
          amount: 999999.99,
        },
      });

      const result = await paymentGateway.processPayment({
        amount: 999999.99,
        currency: 'USD',
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'Large Amount Test',
      });

      expect(result.success).toBe(true);
      expect(result.amount).toBe(999999.99);
    });
  });

  describe('3D Secure Authentication', () => {
    it('should initiate 3D Secure for high-value transactions', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          requiresAuthentication: true,
          authenticationUrl: 'https://3ds.payment-gateway.com/auth/123',
          sessionId: '3ds_session_123',
        },
      });

      const result = await paymentGateway.processPayment({
        amount: 1000.00, // High value triggers 3DS
        currency: 'USD',
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: '3DS Test',
      });

      expect(result.requiresAuthentication).toBe(true);
      expect(result.authenticationUrl).toBeDefined();
    });

    it('should complete payment after 3D Secure authentication', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          transactionId: 'txn_3ds_completed',
          authenticated: true,
        },
      });

      const result = await paymentGateway.complete3DSPayment({
        sessionId: '3ds_session_123',
        authenticationResult: 'success',
      });

      expect(result.success).toBe(true);
      expect(result.authenticated).toBe(true);
    });
  });

  describe('Payment Tokenization', () => {
    it('should tokenize credit card for future use', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          token: 'tok_card_123abc',
          cardLast4: '1111',
          cardType: 'visa',
          expiryMonth: '12',
          expiryYear: '2025',
        },
      });

      const result = await paymentGateway.tokenizeCard({
        cardNumber: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2025',
        cvv: '123',
        cardholderName: 'Token Test',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBe('tok_card_123abc');
      expect(result.cardLast4).toBe('1111');
    });

    it('should process payment with saved token', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          transactionId: 'txn_token_payment',
          amount: 75.00,
        },
      });

      const result = await paymentGateway.processPaymentWithToken({
        token: 'tok_card_123abc',
        amount: 75.00,
        currency: 'USD',
        cvv: '123',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });
  });

  describe('Dispute and Chargeback Handling', () => {
    it('should retrieve dispute information', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          disputeId: 'dp_123',
          transactionId: 'txn_disputed',
          amount: 100.00,
          reason: 'fraudulent',
          status: 'pending',
          createdAt: '2024-01-15T10:00:00Z',
        },
      });

      const result = await paymentGateway.getDispute('dp_123');

      expect(result.disputeId).toBe('dp_123');
      expect(result.reason).toBe('fraudulent');
    });

    it('should submit evidence for dispute', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          evidenceId: 'ev_123',
          status: 'submitted',
        },
      });

      const result = await paymentGateway.submitDisputeEvidence('dp_123', {
        customerCommunication: 'Email thread showing valid purchase',
        shippingDocumentation: 'Tracking number: TRACK123',
        receipt: 'Receipt #12345',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('submitted');
    });
  });
});

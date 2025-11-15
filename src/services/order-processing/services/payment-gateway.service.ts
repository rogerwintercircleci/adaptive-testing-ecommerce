/**
 * Payment Gateway Service
 *
 * Integration with external payment processors
 */

import crypto from 'crypto';
import { BadRequestError, ServiceUnavailableError } from '../../../libs/errors';

export interface PaymentGatewayConfig {
  apiKey: string;
  apiSecret: string;
  endpoint: string;
}

export interface PaymentData {
  amount: number;
  currency: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundData {
  transactionId: string;
  amount: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status?: string;
  amount?: number;
  originalTransactionId?: string;
}

export interface TokenizeCardData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
}

export interface TokenizeResult {
  success: boolean;
  token?: string;
  cardLast4?: string;
  cardType?: string;
  expiryMonth?: string;
  expiryYear?: string;
}

export interface PaymentWithTokenData {
  token: string;
  amount: number;
  currency: string;
  cvv: string;
}

export interface Complete3DSData {
  sessionId: string;
  authenticationResult: string;
}

export interface DisputeEvidence {
  customerCommunication?: string;
  shippingDocumentation?: string;
  receipt?: string;
}

export class PaymentGatewayService {
  private config: PaymentGatewayConfig;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  /**
   * Process credit card payment
   */
  async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    // Validate card expiry
    this.validateCardExpiry(paymentData.expiryMonth, paymentData.expiryYear);

    // Validate minimum amount
    if (paymentData.amount < 0.50) {
      throw new BadRequestError('Payment amount must be at least $0.50');
    }

    // Validate card number
    if (!this.validateCardNumber(paymentData.cardNumber)) {
      throw new BadRequestError('Invalid card number');
    }

    // Validate CVV
    const cardType = this.getCardType(paymentData.cardNumber);
    if (!this.validateCVV(paymentData.cvv, cardType)) {
      throw new BadRequestError('Invalid CVV format');
    }

    // Attempt payment with retries
    return await this.retryOperation(() => this.executePayment(paymentData));
  }

  /**
   * Execute payment (internal)
   */
  private async executePayment(paymentData: PaymentData): Promise<PaymentResult> {
    // In production, this would make actual API call
    // For now, simulate payment processing

    // Simulate network delay
    await this.sleep(100);

    // Check for test card numbers that simulate different scenarios
    if (paymentData.cardNumber === '4000000000000002') {
      return {
        success: false,
        status: 'declined',
        errorCode: 'card_declined',
        errorMessage: 'Your card was declined',
      };
    }

    if (paymentData.cardNumber === '4000000000000341') {
      return {
        success: false,
        status: 'declined',
        errorCode: 'insufficient_funds',
        errorMessage: 'Insufficient funds',
      };
    }

    // Check for 3D Secure requirement (high value)
    if (paymentData.amount >= 1000) {
      return {
        success: false,
        requiresAuthentication: true,
        authenticationUrl: `https://3ds.payment-gateway.com/auth/${this.generateId()}`,
        sessionId: `3ds_session_${this.generateId()}`,
      } as any;
    }

    // Successful payment
    return {
      success: true,
      transactionId: `txn_${this.generateId()}`,
      status: 'approved',
      amount: paymentData.amount,
      currency: paymentData.currency,
    };
  }

  /**
   * Refund payment
   */
  async refundPayment(refundData: RefundData): Promise<RefundResult> {
    return await this.retryOperation(async () => {
      await this.sleep(100);

      return {
        success: true,
        refundId: `rfnd_${this.generateId()}`,
        status: 'completed',
        amount: refundData.amount,
        originalTransactionId: refundData.transactionId,
      };
    });
  }

  /**
   * Generate webhook signature
   */
  generateWebhookSignature(payload: any): string {
    const data = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: any, signature: string): boolean {
    const expectedSignature = this.generateWebhookSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(webhookPayload: any): Promise<{ processed: boolean; event: string }> {
    return {
      processed: true,
      event: webhookPayload.event,
    };
  }

  /**
   * Validate card number using Luhn algorithm
   */
  validateCardNumber(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');

    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Get card type from number
   */
  getCardType(cardNumber: string): string {
    const digits = cardNumber.replace(/\D/g, '');

    if (/^4/.test(digits)) return 'visa';
    if (/^5[1-5]/.test(digits)) return 'mastercard';
    if (/^3[47]/.test(digits)) return 'amex';
    if (/^6(?:011|5)/.test(digits)) return 'discover';

    return 'unknown';
  }

  /**
   * Validate CVV format
   */
  validateCVV(cvv: string, cardType: string): boolean {
    if (cardType === 'amex') {
      return /^\d{4}$/.test(cvv);
    }
    return /^\d{3}$/.test(cvv);
  }

  /**
   * Validate card expiry date
   */
  private validateCardExpiry(month: string, year: string): void {
    const expiryMonth = parseInt(month);
    const expiryYear = parseInt(year);

    if (expiryMonth < 1 || expiryMonth > 12) {
      throw new BadRequestError('Invalid expiry month');
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
      throw new BadRequestError('Card has expired');
    }
  }

  /**
   * Tokenize credit card
   */
  async tokenizeCard(cardData: TokenizeCardData): Promise<TokenizeResult> {
    this.validateCardExpiry(cardData.expiryMonth, cardData.expiryYear);

    if (!this.validateCardNumber(cardData.cardNumber)) {
      throw new BadRequestError('Invalid card number');
    }

    const cardType = this.getCardType(cardData.cardNumber);
    const last4 = cardData.cardNumber.slice(-4);

    return {
      success: true,
      token: `tok_card_${this.generateId()}`,
      cardLast4: last4,
      cardType,
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
    };
  }

  /**
   * Process payment with saved token
   */
  async processPaymentWithToken(data: PaymentWithTokenData): Promise<PaymentResult> {
    if (data.amount < 0.50) {
      throw new BadRequestError('Payment amount must be at least $0.50');
    }

    return await this.retryOperation(async () => {
      await this.sleep(100);

      return {
        success: true,
        transactionId: `txn_token_${this.generateId()}`,
        amount: data.amount,
      };
    });
  }

  /**
   * Complete 3D Secure payment
   */
  async complete3DSPayment(_data: Complete3DSData): Promise<PaymentResult> {
    await this.sleep(100);

    return {
      success: true,
      transactionId: `txn_3ds_${this.generateId()}`,
      authenticated: true,
    } as any;
  }

  /**
   * Get dispute information
   */
  async getDispute(disputeId: string): Promise<any> {
    await this.sleep(50);

    return {
      disputeId,
      transactionId: 'txn_disputed',
      amount: 100.00,
      reason: 'fraudulent',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Submit dispute evidence
   */
  async submitDisputeEvidence(_disputeId: string, _evidence: DisputeEvidence): Promise<any> {
    await this.sleep(50);

    return {
      success: true,
      evidenceId: `ev_${this.generateId()}`,
      status: 'submitted',
    };
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation errors
        if (error instanceof BadRequestError) {
          throw error;
        }

        // Check if we have retries left
        if (attempt < retries) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw new ServiceUnavailableError(
      `Payment gateway operation failed after ${retries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random ID
   */
  private generateId(): string {
    return crypto.randomBytes(12).toString('hex');
  }
}

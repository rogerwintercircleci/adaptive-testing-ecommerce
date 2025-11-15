/**
 * Integration Tests: Shipping Provider API
 *
 * Testing integration with shipping carriers (UPS, FedEx, USPS, DHL)
 */

import axios from 'axios';
import { ShippingProviderService } from '../../../src/services/order-processing/services/shipping-provider.service';
import { BadRequestError, NotFoundError } from '../../../src/libs/errors';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Shipping Provider Integration Tests', () => {
  let shippingService: ShippingProviderService;

  beforeEach(() => {
    jest.clearAllMocks();
    shippingService = new ShippingProviderService({
      upsApiKey: 'ups-test-key',
      fedexApiKey: 'fedex-test-key',
      uspsApiKey: 'usps-test-key',
      dhlApiKey: 'dhl-test-key',
    });
  });

  describe('Calculate Shipping Rates', () => {
    it('should get shipping rates from UPS', async () => {
      const shipment = {
        origin: {
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          country: 'US',
        },
        destination: {
          address: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
        },
        packages: [
          {
            weight: 5,
            length: 10,
            width: 8,
            height: 6,
            units: 'lb',
          },
        ],
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          rates: [
            {
              service: 'UPS Ground',
              cost: 12.50,
              estimatedDays: 5,
            },
            {
              service: 'UPS 2nd Day Air',
              cost: 25.00,
              estimatedDays: 2,
            },
            {
              service: 'UPS Next Day Air',
              cost: 45.00,
              estimatedDays: 1,
            },
          ],
        },
      });

      const rates = await shippingService.getRates('UPS', shipment);

      expect(rates.length).toBe(3);
      expect(rates[0].service).toBe('UPS Ground');
      expect(rates[0].cost).toBe(12.50);
    });

    it('should get shipping rates from multiple carriers', async () => {
      const shipment = {
        origin: {
          zip: '10001',
          country: 'US',
        },
        destination: {
          zip: '90001',
          country: 'US',
        },
        packages: [
          {
            weight: 2,
            length: 12,
            width: 10,
            height: 4,
          },
        ],
      };

      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { rates: [{ service: 'UPS Ground', cost: 8.50 }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rates: [{ service: 'FedEx Ground', cost: 7.99 }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rates: [{ service: 'USPS Priority', cost: 9.25 }] },
        });

      const allRates = await shippingService.compareRates(shipment);

      expect(allRates.UPS.length).toBeGreaterThan(0);
      expect(allRates.FedEx.length).toBeGreaterThan(0);
      expect(allRates.USPS.length).toBeGreaterThan(0);
    });

    it('should find cheapest shipping option', async () => {
      const shipment = {
        origin: { zip: '10001', country: 'US' },
        destination: { zip: '90001', country: 'US' },
        packages: [{ weight: 3 }],
      };

      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { rates: [{ service: 'UPS Ground', cost: 10.00 }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rates: [{ service: 'FedEx Ground', cost: 8.50 }] },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { rates: [{ service: 'USPS Priority', cost: 12.00 }] },
        });

      const cheapest = await shippingService.getCheapestRate(shipment);

      expect(cheapest.carrier).toBe('FedEx');
      expect(cheapest.cost).toBe(8.50);
    });
  });

  describe('Create Shipping Labels', () => {
    it('should create shipping label with UPS', async () => {
      const labelRequest = {
        carrier: 'UPS',
        service: 'UPS Ground',
        shipment: {
          origin: {
            name: 'Warehouse A',
            address: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'US',
          },
          destination: {
            name: 'John Doe',
            address: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            zip: '90001',
            country: 'US',
          },
          packages: [
            {
              weight: 5,
              length: 10,
              width: 8,
              height: 6,
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          trackingNumber: '1Z999AA10123456784',
          labelUrl: 'https://labels.ups.com/label/1Z999AA10123456784.pdf',
          cost: 12.50,
          carrier: 'UPS',
        },
      });

      const label = await shippingService.createLabel(labelRequest);

      expect(label.success).toBe(true);
      expect(label.trackingNumber).toBe('1Z999AA10123456784');
      expect(label.labelUrl).toBeDefined();
    });

    it('should create label with customer reference', async () => {
      const labelRequest = {
        carrier: 'FedEx',
        service: 'FedEx Ground',
        shipment: {
          origin: { zip: '10001', country: 'US' },
          destination: { zip: '90001', country: 'US' },
          packages: [{ weight: 3 }],
        },
        reference: 'ORDER-12345',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          trackingNumber: '773123456789',
          labelUrl: 'https://labels.fedex.com/label/773123456789.pdf',
          reference: 'ORDER-12345',
        },
      });

      const label = await shippingService.createLabel(labelRequest);

      expect(label.reference).toBe('ORDER-12345');
    });

    it('should handle address validation errors', async () => {
      const labelRequest = {
        carrier: 'UPS',
        service: 'UPS Ground',
        shipment: {
          origin: { zip: '10001', country: 'US' },
          destination: { address: 'Invalid Address', zip: '00000', country: 'US' },
          packages: [{ weight: 2 }],
        },
      };

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'invalid_address',
            message: 'Destination address could not be validated',
          },
        },
      });

      await expect(shippingService.createLabel(labelRequest)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('Track Shipments', () => {
    it('should track UPS shipment', async () => {
      const trackingNumber = '1Z999AA10123456784';

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          trackingNumber,
          carrier: 'UPS',
          status: 'in_transit',
          estimatedDelivery: '2024-01-20',
          events: [
            {
              timestamp: '2024-01-15T08:00:00Z',
              location: 'New York, NY',
              status: 'picked_up',
              description: 'Package picked up',
            },
            {
              timestamp: '2024-01-16T14:30:00Z',
              location: 'Chicago, IL',
              status: 'in_transit',
              description: 'In transit',
            },
          ],
        },
      });

      const tracking = await shippingService.trackShipment(trackingNumber);

      expect(tracking.trackingNumber).toBe(trackingNumber);
      expect(tracking.status).toBe('in_transit');
      expect(tracking.events.length).toBe(2);
    });

    it('should track FedEx shipment with detailed events', async () => {
      const trackingNumber = '773123456789';

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          trackingNumber,
          carrier: 'FedEx',
          status: 'delivered',
          deliveredAt: '2024-01-18T16:45:00Z',
          signedBy: 'J. DOE',
          events: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              status: 'picked_up',
            },
            {
              timestamp: '2024-01-18T16:45:00Z',
              status: 'delivered',
              signedBy: 'J. DOE',
            },
          ],
        },
      });

      const tracking = await shippingService.trackShipment(trackingNumber);

      expect(tracking.status).toBe('delivered');
      expect(tracking.signedBy).toBe('J. DOE');
    });

    it('should handle invalid tracking number', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 404,
          data: {
            error: 'tracking_not_found',
          },
        },
      });

      await expect(
        shippingService.trackShipment('INVALID123')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('International Shipping', () => {
    it('should calculate customs duties', async () => {
      const shipment = {
        origin: { country: 'US', zip: '10001' },
        destination: { country: 'GB', zip: 'SW1A 1AA' },
        packages: [
          {
            weight: 10,
            declaredValue: 500.00,
            contents: [
              {
                description: 'Electronics',
                quantity: 2,
                value: 250.00,
                hsCode: '8471.30',
              },
            ],
          },
        ],
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          duties: 45.00,
          taxes: 100.00,
          totalCustoms: 145.00,
          currency: 'GBP',
        },
      });

      const customs = await shippingService.calculateCustoms(shipment);

      expect(customs.totalCustoms).toBe(145.00);
      expect(customs.currency).toBe('GBP');
    });

    it('should create international shipping label with customs forms', async () => {
      const labelRequest = {
        carrier: 'DHL',
        service: 'DHL Express',
        shipment: {
          origin: { country: 'US' },
          destination: { country: 'DE' },
          packages: [
            {
              weight: 5,
              declaredValue: 300.00,
              contents: [
                {
                  description: 'Books',
                  quantity: 3,
                  value: 100.00,
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          trackingNumber: 'DHL123456789',
          labelUrl: 'https://labels.dhl.com/label.pdf',
          customsFormUrl: 'https://labels.dhl.com/customs.pdf',
        },
      });

      const label = await shippingService.createLabel(labelRequest);

      expect(label.customsFormUrl).toBeDefined();
    });

    it('should validate prohibited items for international shipping', async () => {
      const shipment = {
        origin: { country: 'US' },
        destination: { country: 'AU' },
        packages: [
          {
            contents: [
              {
                description: 'Batteries', // Restricted item
                quantity: 10,
              },
            ],
          },
        ],
      };

      mockedAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'prohibited_item',
            message: 'Batteries are restricted for shipping to Australia',
          },
        },
      });

      await expect(
        shippingService.validateInternationalShipment(shipment)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('Pickup Scheduling', () => {
    it('should schedule package pickup', async () => {
      const pickupRequest = {
        carrier: 'UPS',
        date: '2024-01-20',
        timeWindow: {
          start: '09:00',
          end: '17:00',
        },
        location: {
          name: 'Warehouse A',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        packages: 3,
        totalWeight: 25,
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          confirmationNumber: 'PKP123456',
          scheduledDate: '2024-01-20',
          estimatedTime: '10:00-12:00',
        },
      });

      const pickup = await shippingService.schedulePickup(pickupRequest);

      expect(pickup.success).toBe(true);
      expect(pickup.confirmationNumber).toBe('PKP123456');
    });

    it('should cancel scheduled pickup', async () => {
      mockedAxios.delete.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          message: 'Pickup cancelled',
        },
      });

      const result = await shippingService.cancelPickup('PKP123456');

      expect(result.success).toBe(true);
    });
  });

  describe('Address Validation', () => {
    it('should validate and standardize address', async () => {
      const address = {
        address: '123 main st',
        city: 'new york',
        state: 'ny',
        zip: '10001',
        country: 'US',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          valid: true,
          standardized: {
            address: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001-0001',
            country: 'US',
          },
          residential: false,
        },
      });

      const validated = await shippingService.validateAddress(address);

      expect(validated.valid).toBe(true);
      expect(validated.standardized.address).toBe('123 Main St');
      expect(validated.residential).toBe(false);
    });

    it('should suggest corrections for invalid address', async () => {
      const address = {
        address: '123 Main Street',
        city: 'Nowhere',
        state: 'XX',
        zip: '00000',
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          valid: false,
          suggestions: [
            {
              address: '123 Main St',
              city: 'Springfield',
              state: 'IL',
              zip: '62701',
            },
          ],
        },
      });

      const validated = await shippingService.validateAddress(address);

      expect(validated.valid).toBe(false);
      expect(validated.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Shipping Insurance', () => {
    it('should calculate insurance cost', async () => {
      const declaredValue = 1000.00;

      const insuranceCost = await shippingService.calculateInsurance(
        'UPS',
        declaredValue
      );

      expect(insuranceCost).toBeGreaterThan(0);
      expect(insuranceCost).toBe(declaredValue * 0.01); // 1% of value
    });

    it('should create label with insurance', async () => {
      const labelRequest = {
        carrier: 'FedEx',
        service: 'FedEx Ground',
        shipment: {
          origin: { zip: '10001', country: 'US' },
          destination: { zip: '90001', country: 'US' },
          packages: [
            {
              weight: 5,
              declaredValue: 500.00,
              insurance: true,
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          trackingNumber: 'FDX789456123',
          insuranceCost: 5.00,
          totalCost: 17.50,
        },
      });

      const label = await shippingService.createLabel(labelRequest);

      expect(label.insuranceCost).toBe(5.00);
    });
  });

  describe('Return Labels', () => {
    it('should create return shipping label', async () => {
      const returnRequest = {
        carrier: 'UPS',
        originalTracking: '1Z999AA10123456784',
        returnAddress: {
          name: 'Returns Department',
          address: '123 Warehouse Rd',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          trackingNumber: '1Z999AA10987654321',
          labelUrl: 'https://labels.ups.com/return/label.pdf',
          qrCode: 'https://labels.ups.com/return/qr.png',
        },
      });

      const returnLabel = await shippingService.createReturnLabel(returnRequest);

      expect(returnLabel.success).toBe(true);
      expect(returnLabel.trackingNumber).toBeDefined();
      expect(returnLabel.qrCode).toBeDefined();
    });

    it('should create prepaid return label', async () => {
      const returnRequest = {
        carrier: 'FedEx',
        service: 'FedEx Ground',
        prepaid: true,
        returnAddress: {
          zip: '10001',
          country: 'US',
        },
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          trackingNumber: 'FDX987654321',
          prepaid: true,
        },
      });

      const label = await shippingService.createReturnLabel(returnRequest);

      expect(label.prepaid).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should create multiple labels in batch', async () => {
      const batchRequest = {
        carrier: 'UPS',
        shipments: [
          {
            destination: { zip: '90001', country: 'US' },
            packages: [{ weight: 2 }],
          },
          {
            destination: { zip: '60601', country: 'US' },
            packages: [{ weight: 3 }],
          },
          {
            destination: { zip: '75201', country: 'US' },
            packages: [{ weight: 1 }],
          },
        ],
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          labels: [
            { trackingNumber: '1Z001', labelUrl: 'url1' },
            { trackingNumber: '1Z002', labelUrl: 'url2' },
            { trackingNumber: '1Z003', labelUrl: 'url3' },
          ],
        },
      });

      const batch = await shippingService.createBatchLabels(batchRequest);

      expect(batch.labels.length).toBe(3);
      expect(batch.success).toBe(true);
    });

    it('should handle partial batch failures', async () => {
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: false,
          labels: [
            { trackingNumber: '1Z001', success: true },
            { success: false, error: 'Invalid address' },
            { trackingNumber: '1Z003', success: true },
          ],
        },
      });

      const batch = await shippingService.createBatchLabels({
        carrier: 'UPS',
        shipments: [{}, {}, {}],
      } as any);

      const successCount = batch.labels.filter((l: any) => l.success).length;
      expect(successCount).toBe(2);
    });
  });
});

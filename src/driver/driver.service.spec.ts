import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DriverService } from './driver.service';
import { DRIZZLE } from '../database';

describe('DriverService', () => {
  let service: DriverService;

  const mockDriver = {
    id: 1,
    userId: 10,
    status: 'PENDING' as const,
    verificationStatus: 'PENDING' as const,
    availabilityStatus: 'OFFLINE' as const,
  };

  const mockVehicle = {
    id: 100,
    driverId: 1,
    make: 'Mercedes-Benz',
    model: 'S-Class S 580',
    year: 2024,
    color: 'Black',
    registrationNumber: 'NY-CHAUFF-88',
    vinNumber: '1HGCR2F83HA123456',
    category: 'LUXURY' as const,
    passengerCapacity: 3,
    luggageCapacity: 3,
    status: 'PENDING' as const,
    verifiedBy: null,
    verifiedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDb = {
    query: {
      drivers: {
        findFirst: jest.fn(),
      },
      vehicles: {
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn(),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn(),
        }),
      }),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<DriverService>(DriverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerVehicle', () => {
    const registerVehicleDto = {
      make: 'Mercedes-Benz',
      model: 'S-Class S 580',
      year: 2024,
      color: 'Black',
      registrationNumber: 'NY-CHAUFF-88',
      vinNumber: '1HGCR2F83HA123456',
      category: 'LUXURY' as const,
      passengerCapacity: 3,
      luggageCapacity: 3,
    };

    it('should successfully register a vehicle in PENDING status', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);
      mockDb.query.vehicles.findFirst
        .mockResolvedValueOnce(null) // driver vehicle check
        .mockResolvedValueOnce(null) // registration check
        .mockResolvedValueOnce(null); // VIN check

      mockDb.insert().values().returning.mockResolvedValueOnce([mockVehicle]);

      const result = await service.registerVehicle(10, registerVehicleDto);

      expect(result.vehicle).toBeDefined();
      expect(result.vehicle.status).toBe('PENDING');
      expect(result.vehicle.registrationNumber).toBe('NY-CHAUFF-88');
      expect(result.message).toContain('Vehicle registered successfully');
    });

    it('should throw NotFoundException if driver record not found', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.registerVehicle(999, registerVehicleDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if driver already has a vehicle (1:1 constraint)', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);
      mockDb.query.vehicles.findFirst.mockResolvedValueOnce(mockVehicle);

      await expect(
        service.registerVehicle(10, registerVehicleDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if registration number is already registered', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);
      mockDb.query.vehicles.findFirst
        .mockResolvedValueOnce(null) // no vehicle for driver
        .mockResolvedValueOnce(mockVehicle); // registration exists

      await expect(
        service.registerVehicle(10, registerVehicleDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if VIN number is already registered', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);
      mockDb.query.vehicles.findFirst
        .mockResolvedValueOnce(null) // no vehicle for driver
        .mockResolvedValueOnce(null) // registration unique
        .mockResolvedValueOnce(mockVehicle); // VIN exists

      await expect(
        service.registerVehicle(10, registerVehicleDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getVehicle', () => {
    it('should return vehicle details for driver', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);
      mockDb.query.vehicles.findFirst.mockResolvedValueOnce(mockVehicle);

      const result = await service.getVehicle(10);

      expect(result.id).toBe(100);
      expect(result.make).toBe('Mercedes-Benz');
    });

    it('should throw NotFoundException if no vehicle found', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);
      mockDb.query.vehicles.findFirst.mockResolvedValueOnce(null);

      await expect(service.getVehicle(10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle and reset status to PENDING if core details change', async () => {
      mockDb.query.drivers.findFirst.mockResolvedValueOnce(mockDriver);
      mockDb.query.vehicles.findFirst.mockResolvedValueOnce(mockVehicle);

      const updated = { ...mockVehicle, model: 'S-Class S 680 Maybach', status: 'PENDING' as const };
      mockDb.update().set().where().returning.mockResolvedValueOnce([updated]);

      const result = await service.updateVehicle(10, { model: 'S-Class S 680 Maybach' });

      expect(result.vehicle.model).toBe('S-Class S 680 Maybach');
      expect(result.message).toContain('verification status has been reset to PENDING');
    });
  });
});

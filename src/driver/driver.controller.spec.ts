import { Test, TestingModule } from '@nestjs/testing';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';

describe('DriverController', () => {
  let controller: DriverController;

  const mockVehicle = {
    id: 1,
    driverId: 10,
    make: 'Mercedes-Benz',
    model: 'S-Class S 580',
    year: 2024,
    color: 'Black',
    registrationNumber: 'NY-CHAUFF-88',
    category: 'LUXURY' as const,
    passengerCapacity: 3,
    luggageCapacity: 3,
    status: 'PENDING' as const,
  };

  const mockDriverService = {
    registerVehicle: jest.fn().mockResolvedValue({
      vehicle: mockVehicle,
      message: 'Vehicle registered successfully with PENDING status.',
    }),
    getVehicle: jest.fn().mockResolvedValue(mockVehicle),
    updateVehicle: jest.fn().mockResolvedValue({
      vehicle: { ...mockVehicle, color: 'Obsidian Black' },
      message: 'Vehicle details updated successfully.',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DriverController],
      providers: [
        {
          provide: DriverService,
          useValue: mockDriverService,
        },
      ],
    }).compile();

    controller = module.get<DriverController>(DriverController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerVehicle', () => {
    it('should register vehicle via POST /driver/vehicle', async () => {
      const dto = {
        make: 'Mercedes-Benz',
        model: 'S-Class S 580',
        year: 2024,
        color: 'Black',
        registrationNumber: 'NY-CHAUFF-88',
        category: 'LUXURY' as const,
        passengerCapacity: 3,
      };

      const result = await controller.registerVehicle(1, dto);
      expect(result.vehicle.registrationNumber).toBe('NY-CHAUFF-88');
      expect(mockDriverService.registerVehicle).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('getVehicle', () => {
    it('should get registered vehicle via GET /driver/vehicle', async () => {
      const result = await controller.getVehicle(1);
      expect(result.id).toBe(1);
      expect(mockDriverService.getVehicle).toHaveBeenCalledWith(1);
    });
  });

  describe('updateVehicle', () => {
    it('should update vehicle via PATCH /driver/vehicle', async () => {
      const result = await controller.updateVehicle(1, {
        color: 'Obsidian Black',
      });
      expect(result.vehicle.color).toBe('Obsidian Black');
      expect(mockDriverService.updateVehicle).toHaveBeenCalledWith(1, {
        color: 'Obsidian Black',
      });
    });
  });
});

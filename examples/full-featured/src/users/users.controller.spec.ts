import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsers = [
    {
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      role: 'Admin',
      status: 'active',
    },
    {
      id: 2,
      name: 'Bob Smith',
      email: 'bob@example.com',
      role: 'User',
      status: 'active',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should return an array of users', () => {
      jest.spyOn(service, 'findAll').mockReturnValue(mockUsers);

      const result = controller.list();

      expect(result).toEqual({ users: mockUsers });
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('profile', () => {
    it('should return a single user when found', () => {
      const userId = '1';
      jest.spyOn(service, 'findOne').mockReturnValue(mockUsers[0]);

      const result = controller.profile(userId);

      expect(result).toEqual({ user: mockUsers[0] });
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when user not found', () => {
      const userId = '999';
      jest.spyOn(service, 'findOne').mockReturnValue(undefined);

      expect(() => controller.profile(userId)).toThrow(NotFoundException);
      expect(() => controller.profile(userId)).toThrow(
        'User with ID 999 not found',
      );
    });
  });

  describe('apiList', () => {
    it('should return an array of users for API calls', () => {
      jest.spyOn(service, 'findAll').mockReturnValue(mockUsers);

      const result = controller.apiList();

      expect(result).toEqual(mockUsers);
      expect(service.findAll).toHaveBeenCalled();
    });
  });
});

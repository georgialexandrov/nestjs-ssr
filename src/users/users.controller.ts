import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { ReactRender } from '../shared/render/decorators/react-render.decorator.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ReactRender('users/views/user-list')
  list() {
    const users = this.usersService.findAll();
    return { users };
  }

  @Get(':id')
  @ReactRender('users/views/user-profile')
  profile(@Param('id') id: string) {
    const user = this.usersService.findOne(parseInt(id, 10));
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { user };
  }

  // API endpoint for client-side calls (if needed)
  @Get('api/all')
  apiList() {
    return this.usersService.findAll();
  }
}

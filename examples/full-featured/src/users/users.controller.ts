import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { UsersService, User } from './users.service';
import { Render } from '@nestjs-ssr/react';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Render('users/views/user-list')
  list(): { users: User[] } {
    const users = this.usersService.findAll();
    return { users };
  }

  @Get(':id')
  @Render('users/views/user-profile')
  profile(@Param('id') id: string): { user: User } {
    const user = this.usersService.findOne(parseInt(id, 10));
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { user };
  }

  // API endpoint for client-side calls (if needed)
  @Get('api/all')
  apiList(): User[] {
    return this.usersService.findAll();
  }
}

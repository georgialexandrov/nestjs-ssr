import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { ShowcaseController } from './controllers/showcase.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, ShowcaseController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

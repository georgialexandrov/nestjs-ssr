import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

/**
 * Simple auth guard that simulates JWT authentication.
 * In a real app, this would validate a JWT token and fetch user from database.
 */
@Injectable()
export class SimpleAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: User }>();

    request.user = {
      id: 'user-123',
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'admin',
    };

    return true;
  }
}

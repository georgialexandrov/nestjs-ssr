import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Simple mock user type for demonstration
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

/**
 * Extend Express Request to include user
 */
declare module 'express' {
  interface Request {
    user?: User;
  }
}

/**
 * Simple auth guard that simulates JWT authentication.
 * In a real app, this would validate a JWT token and fetch user from database.
 *
 * For demo purposes, it always sets a mock user on the request.
 */
@Injectable()
export class SimpleAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Simulate JWT validation - in real app this would:
    // 1. Extract token from Authorization header
    // 2. Verify JWT signature
    // 3. Fetch user from database
    // For demo, we just set a mock user
    request.user = {
      id: 'user-123',
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'admin',
    };

    return true;
  }
}

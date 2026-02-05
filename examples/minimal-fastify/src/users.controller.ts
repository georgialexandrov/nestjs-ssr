import { Controller, Get, Param } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import UsersLayout from './views/users-layout';
import Users from './views/users';
import UserDetail from './views/user-detail';
import UsersSettings from './views/users-settings';

// Mock user data
const users = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    bio: 'Frontend developer passionate about React and TypeScript. Loves building beautiful user interfaces.',
    joinedAt: '2023-01-15',
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    bio: 'Full-stack engineer with expertise in NestJS and Node.js. Open source contributor.',
    joinedAt: '2023-03-22',
  },
  {
    id: 3,
    name: 'Carol Williams',
    email: 'carol@example.com',
    bio: 'DevOps specialist focused on CI/CD and cloud infrastructure. Docker enthusiast.',
    joinedAt: '2023-06-10',
  },
];

/**
 * Users controller with nested layout.
 * All routes in this controller will have:
 * - RootLayout (from views/layout.tsx - auto-discovered)
 * - UsersLayout (from @Layout decorator)
 * - Page component (from @Render decorator)
 */
@Controller('users')
@Layout(UsersLayout)
export class UsersController {
  @Get()
  @Render(Users)
  getUsers() {
    return {
      users: users.map(({ id, name, email }) => ({ id, name, email })),
    };
  }

  @Get('settings')
  @Render(UsersSettings)
  getSettings() {
    return {
      settings: {
        emailNotifications: true,
        darkMode: false,
        language: 'English',
      },
    };
  }

  @Get(':id')
  @Render(UserDetail)
  getUserDetail(@Param('id') id: string) {
    const user = users.find((u) => u.id === parseInt(id, 10));
    if (!user) {
      return {
        user: {
          id: 0,
          name: 'Not Found',
          email: '',
          bio: 'User not found',
          joinedAt: '',
        },
      };
    }
    return { user };
  }
}

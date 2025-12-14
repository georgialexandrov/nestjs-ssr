import { Controller, Get, Param } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import Home from './views/home';
import About from './views/about';
import Users from './views/users';
import UserDetail from './views/user-detail';

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

@Controller()
export class AppController {
  @Get()
  @Render(Home)
  getHome() {
    return {
      message: 'Hello from NestJS SSR!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('about')
  @Render(About)
  getAbout() {
    return {
      version: '0.2.5',
      features: [
        'Server-side rendering with React 19',
        'Client-side segment navigation (no full page reload)',
        'Automatic layout detection and composition',
        'View Transitions API support (progressive enhancement)',
        'Browser back/forward navigation support',
        'Programmatic navigation via useNavigate() hook',
      ],
    };
  }

  @Get('users')
  @Render(Users)
  getUsers() {
    return {
      users: users.map(({ id, name, email }) => ({ id, name, email })),
    };
  }

  @Get('users/:id')
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

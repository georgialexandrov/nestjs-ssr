import { Injectable } from '@nestjs/common';

export interface User {
  id: number;
  name: string;
  email: string;
  bio?: string;
}

@Injectable()
export class UsersService {
  // Mock data - no database needed for prototype
  private readonly users: User[] = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      bio: 'Full-stack developer passionate about React and NestJS',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      bio: 'Frontend specialist with expertise in React and TypeScript',
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@example.com',
      bio: 'Backend engineer focused on scalable Node.js applications',
    },
  ];

  findAll(): User[] {
    return this.users;
  }

  findOne(id: number): User | undefined {
    return this.users.find((user) => user.id === id);
  }
}

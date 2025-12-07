# Forms and Data Fetching

Learn how to handle forms, async data, and user interactions in your SSR application.

## Table of Contents

- [Fetching Data from Services](#fetching-data-from-services)
- [Handling Form Submissions](#handling-form-submissions)
- [Progressive Enhancement](#progressive-enhancement)
- [Loading States and Suspense](#loading-states-and-suspense)
- [Validation and Error Handling](#validation-and-error-handling)

## Fetching Data from Services

### The Clean Architecture Way

With @nestjs-ssr/react, your views use the same services as your REST API. No duplication, no separate data layer.

**Service** (`src/users/users.service.ts`):
```typescript
@Injectable()
export class UsersService {
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    return this.userRepository.findOneOrFail(id);
  }
}
```

**Controller** (`src/users/users.controller.ts`):
```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Render('users/views/list')
  async listUsers() {
    const users = await this.usersService.findAll();
    return { users };
  }

  @Get(':id')
  @Render('users/views/profile')
  async showUser(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return {
      user,
      head: {
        title: `${user.name} - User Profile`,
        description: `Profile page for ${user.name}`,
      },
    };
  }
}
```

**View** (`src/users/views/list.tsx`):
```typescript
import type { PageProps } from '@nestjs-ssr/react';
import type { User } from '../entities/user.entity';

interface ListData {
  users: User[];
}

export default function UserList({ data }: PageProps<ListData>) {
  return (
    <html>
      <head><title>Users</title></head>
      <body>
        <h1>Users</h1>
        <ul>
          {data.users.map(user => (
            <li key={user.id}>
              <a href={`/users/${user.id}`}>{user.name}</a>
            </li>
          ))}
        </ul>
      </body>
    </html>
  );
}
```

### Benefits

✅ **Single source of truth** - Same service for REST API and SSR
✅ **Type safety** - TypeScript types flow from entity → service → controller → view
✅ **Dependency injection** - All NestJS features work (guards, interceptors, caching)
✅ **Testable** - Mock services like any NestJS controller

## Handling Form Submissions

### Pattern 1: Traditional Form Submission (Progressive Enhancement)

Best for forms that should work without JavaScript.

**Controller** (`src/auth/auth.controller.ts`):
```typescript
import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Render } from '@nestjs-ssr/react';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @Render('auth/views/login')
  showLoginForm() {
    return {};
  }

  @Post('login')
  async handleLogin(
    @Body() credentials: LoginDto,
    @Res() res: Response,
  ) {
    try {
      const token = await this.authService.login(credentials);
      res.cookie('token', token, { httpOnly: true });
      res.redirect('/dashboard');
    } catch (error) {
      // Re-render form with error
      return res.status(401).render('auth/views/login', {
        error: 'Invalid credentials',
        email: credentials.email,
      });
    }
  }
}
```

**View** (`src/auth/views/login.tsx`):
```typescript
import type { PageProps } from '@nestjs-ssr/react';

interface LoginData {
  error?: string;
  email?: string;
}

export default function Login({ data }: PageProps<LoginData>) {
  return (
    <html>
      <head><title>Login</title></head>
      <body>
        <h1>Login</h1>
        {data.error && <div className="error">{data.error}</div>}
        <form method="POST" action="/auth/login">
          <input
            type="email"
            name="email"
            defaultValue={data.email}
            placeholder="Email"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
          />
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  );
}
```

### Pattern 2: API Endpoint + Client-Side Fetch

Better UX with loading states and no page reload.

**Controller**:
```typescript
@Controller('users')
export class UsersController {
  // SSR route - shows form
  @Get('new')
  @Render('users/views/create')
  showCreateForm() {
    return {};
  }

  // API route - handles submission
  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return user;
  }
}
```

**View** (`src/users/views/create.tsx`):
```typescript
import { useState, FormEvent } from 'react';

export default function CreateUser() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      if (!response.ok) throw new Error('Failed to create user');

      const user = await response.json();
      window.location.href = `/users/${user.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <html>
      <head><title>Create User</title></head>
      <body>
        <h1>Create User</h1>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name"
            required
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </body>
    </html>
  );
}
```

### Pattern 3: Hybrid (Best of Both)

Form works without JS, enhanced with JS when available.

```typescript
import { useState, FormEvent } from 'react';

export default function CreateUser() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const response = await fetch('/users', {
      method: 'POST',
      body: formData,
    });

    if (response.redirected) {
      window.location.href = response.url;
    }
  };

  return (
    <form
      method="POST"
      action="/users"
      onSubmit={handleSubmit}
    >
      <input name="name" required />
      <input name="email" type="email" required />
      <button disabled={loading}>
        {loading ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

## Progressive Enhancement

Make your forms work even if JavaScript fails to load:

### Checklist

- ✅ Use `<form method="POST" action="/endpoint">` (not just `onSubmit`)
- ✅ Include `name` attributes on inputs
- ✅ Handle both API responses and form submissions in controller
- ✅ Show server-side validation errors
- ✅ Enhance with JavaScript for better UX

### Example: Progressive Search

```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@nestjs-ssr/react';

export default function SearchPage({ data }: PageProps<{ results: Product[] }>) {
  const query = useQuery();
  const [results, setResults] = useState(data.results);
  const initialQuery = query.q as string || '';

  // Client-side search enhancement
  const handleSearch = async (q: string) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    setResults(data.results);
  };

  return (
    <html>
      <body>
        <h1>Search</h1>
        {/* Works without JS via form submission */}
        <form method="GET" action="/search">
          <input
            name="q"
            defaultValue={initialQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search products..."
          />
          <button type="submit">Search</button>
        </form>

        <ul>
          {results.map(product => (
            <li key={product.id}>{product.name}</li>
          ))}
        </ul>
      </body>
    </html>
  );
}
```

## Loading States and Suspense

### React 19 Streaming SSR

Use Suspense to stream parts of your page:

**Controller**:
```typescript
@Get('dashboard')
@Render('views/dashboard')
async getDashboard() {
  // Fast data loads immediately
  const user = await this.usersService.getCurrentUser();

  return {
    user,
    // Slow data can stream
    statsPromise: this.analyticsService.getStats(),
    mode: 'stream', // Enable streaming
  };
}
```

**View**:
```typescript
import { Suspense } from 'react';

function Stats({ promise }: { promise: Promise<any> }) {
  const stats = use(promise); // React 19 hook
  return <div>Orders: {stats.orders}</div>;
}

export default function Dashboard({ data }: PageProps) {
  return (
    <html>
      <body>
        <h1>Welcome, {data.user.name}</h1>

        <Suspense fallback={<div>Loading stats...</div>}>
          <Stats promise={data.statsPromise} />
        </Suspense>
      </body>
    </html>
  );
}
```

The shell renders immediately, stats stream in when ready!

## Validation and Error Handling

### Server-Side Validation with class-validator

**DTO** (`src/users/dto/create-user.dto.ts`):
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;
}
```

**Controller**:
```typescript
@Post()
async create(@Body() dto: CreateUserDto) {
  try {
    return await this.usersService.create(dto);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new BadRequestException(error.constraints);
    }
    throw error;
  }
}
```

### Display Validation Errors

```typescript
interface CreateUserData {
  errors?: Record<string, string>;
  values?: Partial<CreateUserDto>;
}

export default function CreateUser({ data }: PageProps<CreateUserData>) {
  return (
    <form method="POST">
      <div>
        <input
          name="name"
          defaultValue={data.values?.name}
        />
        {data.errors?.name && (
          <span className="error">{data.errors.name}</span>
        )}
      </div>

      <div>
        <input
          name="email"
          type="email"
          defaultValue={data.values?.email}
        />
        {data.errors?.email && (
          <span className="error">{data.errors.email}</span>
        )}
      </div>

      <button>Create</button>
    </form>
  );
}
```

## Best Practices

### Do's ✅

- **Share services** between REST and SSR routes
- **Use DTOs** for type-safe data transfer
- **Validate server-side** always (never trust client)
- **Progressive enhancement** - forms work without JS
- **Use Suspense** for slow data in streaming mode
- **Handle errors gracefully** with user-friendly messages

### Don'ts ❌

- **Don't fetch data in components** - do it in the controller
- **Don't duplicate services** - reuse your existing NestJS services
- **Don't skip validation** - always validate on the server
- **Don't ignore no-JS users** - use proper forms with `method` and `action`
- **Don't block rendering** - stream slow parts with Suspense

## Next Steps

- 📖 [Production Deployment Checklist](./production-deployment.md)
- 🏗️ [Architecture and Clean Architecture Patterns](../ARCHITECTURE.md)
- 🔒 [Security Best Practices](../SECURITY.md)

---

**Questions?** Check the [examples](../../examples/full-featured/) or [open an issue](https://github.com/georgialexandrov/nestjs-ssr/issues).

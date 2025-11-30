# NestJS + React SSR Framework

A production-ready server-side rendering (SSR) framework that combines **NestJS** for the backend with **React** for the view layer, featuring full TypeScript support, hot module replacement, and production build optimization.

## Features

- **NestJS Architecture** - Domain-driven design with controllers, services, and modules
- **React SSR** - Server-side rendering with client-side hydration
- **Type Safety** - Full TypeScript support from server to client
- **Hot Module Replacement** - Instant updates during development with Vite
- **Production Ready** - Optimized builds with content hashing and caching
- **Security Headers** - Helmet.js with SSR-appropriate Content Security Policy
- **Request Context** - Access params, query, headers in React components via hooks
- **Clean Separation** - Each module owns its views (Clean Architecture)

## Quick Start

### Installation

```bash
pnpm install
```

### Development

```bash
# Start development server with HMR
pnpm start:dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Production

```bash
# Build for production
pnpm build

# Start production server
pnpm start:prod
```

## Project Structure

```
src/
├── view/                      # Client infrastructure
│   ├── entry-client.tsx       # Client hydration entry point
│   ├── entry-server.tsx       # SSR rendering entry point
│   ├── app.tsx                # Root React app wrapper
│   └── template.html          # HTML template
│
├── app/                       # Root application module
│   ├── app.controller.ts      # Root controller
│   ├── app.module.ts          # Root NestJS module
│   └── views/                 # App-level React views
│       └── home.tsx
│
├── users/                     # Example domain module
│   ├── users.controller.ts    # NestJS controller
│   ├── users.service.ts       # Business logic
│   ├── users.module.ts        # Module definition
│   └── views/                 # React views for this module
│       ├── user-list.tsx
│       └── user-profile.tsx
│
├── shared/                    # Shared code
│   ├── render/                # SSR infrastructure
│   │   ├── render.service.ts
│   │   ├── render.interceptor.ts
│   │   ├── render.module.ts
│   │   ├── decorators/
│   │   └── interfaces/
│   └── views/                 # Shared React components
│       ├── layout.tsx
│       ├── button.tsx
│       └── counter.tsx
│
└── main.ts                    # Application bootstrap
```

## Usage Example

### 1. Create a Controller

```typescript
// src/users/users.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ReactRender } from '@shared/render/decorators/react-render.decorator';
import { UsersService } from './users.service';

interface UserListData {
  users: User[];
  total: number;
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ReactRender('users/views/user-list')
  list(): UserListData {
    return {
      users: this.usersService.findAll(),
      total: this.usersService.count(),
    };
  }

  @Get(':id')
  @ReactRender('users/views/user-profile')
  profile(@Param('id') id: string) {
    return {
      user: this.usersService.findOne(parseInt(id, 10)),
    };
  }
}
```

### 2. Create a React View

```typescript
// src/users/views/user-list.tsx
import type { PageProps } from '@shared/render/interfaces';
import { useParams, useQuery } from '@view/hooks/use-page-context';

interface UserListData {
  users: User[];
  total: number;
}

export default function UserList({ data, context }: PageProps<UserListData>) {
  const { users, total } = data;
  const query = useQuery();

  return (
    <div>
      <h1>Users ({total})</h1>
      {users.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

### 3. Register the View

```typescript
// src/view/entry-server.tsx
import UserList from '../users/views/user-list';

const viewRegistry: Record<string, React.ComponentType<any>> = {
  'users/views/user-list': UserList,
  // ... other views
};
```

```typescript
// src/view/entry-client.tsx (same registration)
import UserList from '../users/views/user-list';

const viewRegistry: Record<string, React.ComponentType<any>> = {
  'users/views/user-list': UserList,
  // ... other views
};
```

## How It Works

1. **Request**: HTTP GET /users
2. **NestJS Router**: Matches route to UsersController.list()
3. **@ReactRender Decorator**: Metadata attached to method
4. **RenderInterceptor**: Intercepts controller response
5. **RenderService**: Renders React component with data
6. **React SSR**: Server renders component to HTML string
7. **Template Injection**: HTML injected into template with hydration data
8. **Response**: Complete HTML sent to browser
9. **Client Hydration**: JavaScript "wakes up" the static HTML
10. **Interactive**: Page becomes fully interactive

## Development vs Production

### Development Mode
- Vite dev server for instant HMR
- On-the-fly TypeScript/JSX transformation
- Source maps for debugging
- Fast startup (~2-3 seconds)

### Production Mode
- Pre-built optimized bundles
- Content-hashed filenames for cache busting
- Minified and tree-shaken code
- Long-term caching (1 year for hashed assets)
- No Vite overhead
- Fast startup (~1 second)

**Build output:**
- Client bundle: ~202KB (with Vite manifest)
- Server bundle: ~21KB (with Vite manifest)

## Scripts

```bash
# Development
pnpm start:dev          # Start dev server with HMR

# Production
pnpm build              # Build all (client + server + NestJS)
pnpm build:client       # Build client bundle only
pnpm build:server       # Build server SSR bundle only
pnpm start:prod         # Start production server

# Other
pnpm format             # Format code with Prettier
pnpm lint               # Lint code with ESLint
pnpm test               # Run tests
```

## Documentation

Comprehensive documentation is available in the [docs/](docs/) directory:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Architecture overview and design patterns
- [TYPE_SAFETY.md](docs/TYPE_SAFETY.md) - Type safety system and PageProps
- [SECURITY.md](docs/SECURITY.md) - Security headers and CSP configuration
- [EXTENDING_CONTEXT.md](docs/EXTENDING_CONTEXT.md) - How to extend RenderContext
- [BEST_PRACTICES.md](docs/BEST_PRACTICES.md) - SSR framework best practices
- [PRODUCTION_RISKS.md](docs/PRODUCTION_RISKS.md) - Production deployment risks
- [ROADMAP.md](docs/ROADMAP.md) - Development roadmap and progress
- [NPM_PACKAGE_DESIGN.md](docs/NPM_PACKAGE_DESIGN.md) - Future npm package design

## Technology Stack

- **Backend**: NestJS v10+
- **View Layer**: React 18+ (with SSR)
- **Build Tool**: Vite 6+
- **Language**: TypeScript 5+
- **Runtime**: Node.js 18+
- **Security**: Helmet.js v8+
- **Serialization**: serialize-javascript (XSS protection)

## Key Features

### Type-Safe Props

```typescript
interface UserData {
  users: User[];
}

// Controller - typed return value
@ReactRender('users/views/list')
list(): UserData {
  return { users: this.service.findAll() };
}

// Component - typed props
export default function UserList({ data }: PageProps<UserData>) {
  const { users } = data; // TypeScript knows the type!
  return <div>...</div>;
}
```

### Request Context Hooks

```typescript
import { useParams, useQuery, useUser } from '@view/hooks/use-page-context';

export default function Profile({ data }: PageProps<ProfileData>) {
  const params = useParams();      // { id: '123' }
  const query = useQuery();        // { tab: 'posts' }
  const user = useUser();          // Current user

  return <div>Viewing user {params.id}</div>;
}
```

### Security Headers

Production-ready security with Helmet.js:
- Content Security Policy (SSR-appropriate)
- Clickjacking protection
- HTTPS enforcement (production)
- MIME-sniffing prevention
- And more...

## Current Status

**Phase 2.2 Complete** - Production build system fully implemented and tested:

- ✅ Production build process
- ✅ Environment-aware bootstrap
- ✅ Content-hashed assets
- ✅ Cache headers (immutable + revalidation)
- ✅ Helmet.js security headers
- ✅ Type-safe props system
- ✅ Request context access

**Next up (Phase 3)**:
- Auto-generated view registry
- Code splitting
- Streaming SSR
- Response caching

See [ROADMAP.md](docs/ROADMAP.md) for full details.

## Contributing

This is currently a prototype/research project. Contributions are welcome once the core architecture is finalized.

## License

[MIT](LICENSE)

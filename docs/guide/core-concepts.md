# Core Concepts

This guide explains the key concepts of server-side rendering in NestJS SSR.

## Server-Side Rendering

Server-side rendering generates HTML on the server. When a request arrives, the server runs your React component, converts it to HTML, and sends it to the browser.

**Why SSR:**

- Search engines see rendered content
- Faster initial page load
- Better performance on slow devices
- Unified codebase - views and backend logic together

**The flow:**

```typescript
import ProductDetail from './views/product-detail';

@Get('/products/:id')
@Render(ProductDetail)
async getProduct(@Param('id') id: string) {
  return { product: await this.productService.findById(id) };
}
```

1. Controller method runs and returns data
2. `@Render` decorator intercepts the response with type-safe component reference
3. React component renders to HTML string
4. Template injects HTML and serialized data
5. Browser receives complete HTML with embedded state

## Hydration

Hydration is React's process of attaching event listeners to server-rendered HTML. Instead of re-rendering, React reuses existing DOM nodes.

**The process:**

1. Browser receives HTML with embedded state
2. JavaScript loads and reads `window.__INITIAL_STATE__`
3. React finds the component using Vite's glob imports
4. Calls `hydrateRoot()` with the same props used on server
5. Event listeners attach - page becomes interactive

**Avoiding hydration mismatches:**

Server and client must render identical HTML. Common issues:

```typescript
// ❌ Don't use current time, random values, or browser APIs
function Bad() {
  return <div>{new Date().toISOString()}</div>;
}

// ✅ Use stable values from props
function Good(props: PageProps<{ timestamp: string }>) {
  return <div>{props.timestamp}</div>;
}

// ✅ Use useEffect for browser-only code
function ClientOnly() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setWidth(window.innerWidth);
  }, []);

  return <div>{width || 'Loading...'}</div>;
}
```

## Component-Based Rendering

NestJS SSR uses direct component imports instead of string paths. Import your React components and pass them to the `@Render` decorator:

```typescript
import Home from './views/home';
import ProductDetail from './views/product-detail';

@Controller()
export class ProductController {
  @Get()
  @Render(Home) // Direct component reference
  getHome() {
    return { message: 'Hello' };
  }

  @Get('/products/:id')
  @Render(ProductDetail) // Type-safe!
  async getProduct(@Param('id') id: string) {
    return { product: await this.productService.findById(id) };
  }
}
```

**Benefits:**

- **Type Safety**: TypeScript validates your return types match component props
- **IDE Navigation**: Cmd+Click to jump to view files
- **Refactoring**: Rename components with confidence
- **No Magic**: Explicit imports, no generated files

**Organize views by feature:**

```
products/
├── products.controller.ts
├── products.service.ts
└── views/
    ├── product-list.tsx
    └── product-detail.tsx
```

Client-side hydration uses Vite's `import.meta.glob` to auto-discover components in `src/views/**/*.tsx`.

## Request Context

Every view has access to request context via React hooks. The context includes URL information, route parameters, query strings, headers, and more:

```typescript
interface RenderContext {
  url: string;
  path: string;
  query: Record<string, any>;
  params: Record<string, string>;
  method: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  userAgent?: string;
  acceptLanguage?: string;
  referer?: string;
}
```

**Access via hooks:**

```typescript
import { useRequest, useParams, useQuery } from '@nestjs-ssr/react';

export default function MyView(props: PageProps<{ product: Product }>) {
  const { product } = props;
  const request = useRequest(); // Full request context
  const params = useParams();   // Route parameters only
  const query = useQuery();     // Query string only

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Current path: {request.path}</p>
      <p>Product ID: {params.id}</p>
      <p>Page: {query.page || 1}</p>
    </div>
  );
}
```

**Available hooks:**

- `useRequest()` - Returns full request context (alias for `usePageContext()`)
- `usePageContext()` - Returns full request context
- `useParams()` - Returns route parameters only
- `useQuery()` - Returns query string parameters only
- `useUserAgent()` - Returns User-Agent header
- `useAcceptLanguage()` - Returns Accept-Language header
- `useReferer()` - Returns Referer header

## The `@Render` Decorator

The `@Render` decorator marks controller methods for React rendering. Pass a component directly for type-safe rendering:

```typescript
import Home from './views/home';

@Get()
@Render(Home)
getHome() {
  return { message: 'Hello' };
}
```

**Type safety:**

The decorator provides compile-time type checking. The return value must match component props:

```typescript
import Home from './views/home';

interface HomeProps {
  message: string;
}

export default function Home(props: PageProps<HomeProps>) {
  return <h1>{props.message}</h1>;
}

@Render(Home)
getHome() {
  return { message: 'Hello' };  // ✅ TypeScript validates this
  // return { wrong: 'data' };  // ❌ TypeScript error!
}
```

**Async handlers:**

Controllers can be async. The system waits for promises:

```typescript
import UserProfile from './views/user-profile';

@Render(UserProfile)
async getUser(@Param('id') id: string) {
  const user = await this.userService.findById(id);
  return { user };
}
```

## Testing

This architecture makes testing straightforward.

**Test controllers by asserting return values:**

```typescript
it('returns product data', async () => {
  const mockService = {
    findById: jest.fn().mockResolvedValue({ id: '123', name: 'Widget' }),
  };
  const controller = new ProductController(mockService as any);

  const result = await controller.getProduct('123');

  expect(result).toEqual({ product: { id: '123', name: 'Widget' } });
});
```

**Test views as React components:**

```typescript
import { PageContextProvider } from '@nestjs-ssr/react';

it('displays product name', () => {
  const mockContext = {
    path: '/products/123',
    params: { id: '123' },
    query: {},
    url: '/products/123',
    method: 'GET'
  };

  const { getByText } = render(
    <PageContextProvider context={mockContext}>
      <ProductDetail product={{ id: '123', name: 'Widget' }} />
    </PageContextProvider>
  );

  expect(getByText('Widget')).toBeInTheDocument();
});
```

Each layer has a clear contract and tests independently.

## Next Steps

- [Development Setup](/guide/development-setup) - Configure HMR modes
- [Head Tags](/guide/head-tags) - Add meta tags and SEO

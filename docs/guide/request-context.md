# Request Context

Hooks expose request data to components. Works during SSR and after hydration.

## Hooks

```tsx
import {
  useParams,
  useQuery,
  useHeaders,
  useSession,
  useRequest,
  usePageContext,
} from '@nestjs-ssr/react/client';
```

Use `/client` for browser-safe imports. The main export includes server-only code.

**useParams** — Route parameters:

```tsx
const { id } = useParams<{ id: string }>();
```

**useQuery** — Query string:

```tsx
const { page, sort } = useQuery<{ page?: string; sort?: string }>();
```

**useHeaders** — Filtered headers:

```tsx
const headers = useHeaders();
```

**useSession** — Filtered session:

```tsx
const { theme } = useSession<{ theme: string }>();
```

**useRequest** — Full request:

```tsx
const { url, method, params, query } = useRequest();
```

**usePageContext** — Everything:

```tsx
const ctx = usePageContext();
```

## Filtering

Headers and session are not exposed by default. Whitelist explicitly:

```typescript
RenderModule.forRoot({
  allowedHeaders: ['accept-language', 'x-custom-header'],
  allowedSessionProps: ['theme', 'locale', 'currency'],
});
```

Everything else stays server-side.

## Custom Data

Return it from controller:

```typescript
@Get('dashboard')
@Render(Dashboard)
async getDashboard(@CurrentUser() user: User) {
  return {
    stats: await this.statsService.getForUser(user.id),
    user: { id: user.id, name: user.name, role: user.role },
  };
}
```

Component receives it in `data`:

```tsx
export default function Dashboard({ data }: PageProps<Props>) {
  return <h1>Welcome, {data.user.name}</h1>;
}
```

Auth, permissions, feature flags, A/B variants — same pattern.

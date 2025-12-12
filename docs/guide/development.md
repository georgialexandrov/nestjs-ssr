# Development

Two modes. Different trade-offs.

## Integrated Mode

One process. Vite inside NestJS.

```bash
npm run dev
```

Component changes trigger full page refresh. Simpler setup.

## Proxy Mode

Two processes. Separate Vite server. True HMR.

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

Component changes hot-reload. State preserved.

## Which To Use

|                 | Integrated         | Proxy         |
| --------------- | ------------------ | ------------- |
| Setup           | One terminal       | Two terminals |
| React changes   | Full refresh       | HMR           |
| State preserved | No                 | Yes           |
| Best for        | Backend-heavy work | UI-heavy work |

Working mostly on controllers? Integrated.

Iterating on components? Proxy.

## Production

```bash
npm run build
npm run start:prod
```

Vite builds optimized bundles. Manifest tells NestJS which chunks to load.

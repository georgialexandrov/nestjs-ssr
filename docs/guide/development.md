# Development

Two modes. Different trade-offs.

## Integrated Mode

One process. Vite inside NestJS.

```bash
npm run dev
```

Component changes trigger full page refresh. Simpler setup.

## Separate Mode

Two processes. Separate Vite server. True HMR.

```bash
npm run start:dev
```

Or manually:

```bash
# Terminal 1
npm run dev:nest

# Terminal 2
npm run dev:vite
```

Component changes hot-reload. State preserved.

## Which To Use

|                 | Integrated         | Separate      |
| --------------- | ------------------ | ------------- |
| Setup           | One terminal       | One command   |
| React changes   | Full refresh       | HMR           |
| State preserved | No                 | Yes           |
| Best for        | Backend-heavy work | UI-heavy work |

Working mostly on controllers? Integrated.

Iterating on components? Separate.

## Production

```bash
npm run build
npm run start:prod
```

Vite builds optimized bundles. Manifest tells NestJS which chunks to load.

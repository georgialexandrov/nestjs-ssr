# Production Deployment Checklist

A practical checklist to deploy your NestJS SSR application to production safely.

## Pre-Deployment Checklist

### ✅ Build Configuration

- [ ] **Build all assets**
  ```bash
  npm run build:client  # Vite client build
  npm run build:server  # Vite SSR build
  npm run build         # NestJS build
  ```

- [ ] **Verify dist/ structure**
  ```
  dist/
  ├── client/           # Static assets (JS, CSS)
  │   ├── assets/
  │   └── manifest.json
  ├── server/           # SSR bundle
  │   └── entry-server.js
  └── *.js              # NestJS compiled code
  ```

- [ ] **Test production build locally**
  ```bash
  NODE_ENV=production node dist/main
  ```

### ✅ Environment Variables

- [ ] **Set NODE_ENV=production**
- [ ] **Configure secrets** (database, API keys, JWT secrets)
- [ ] **Set base URL** for assets if using CDN
- [ ] **Disable Vite dev mode** (only in development)

Example `.env.production`:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
CDN_URL=https://cdn.yourapp.com
```

### ✅ Security

- [ ] **Enable helmet** for security headers
  ```typescript
  import helmet from 'helmet';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],  // Adjust for your needs
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }));
  ```

- [ ] **Enable CORS** properly
  ```typescript
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });
  ```

- [ ] **Rate limiting** on sensitive routes
  ```typescript
  import rateLimit from '@nestjs/throttler';

  @Module({
    imports: [
      ThrottlerModule.forRoot({
        ttl: 60,
        limit: 10,
      }),
    ],
  })
  ```

- [ ] **Validate all inputs** with DTOs and class-validator
- [ ] **Sanitize user content** to prevent XSS (serialize-javascript handles this in @nestjs-ssr/react)
- [ ] **Use HTTPS** in production (terminate at load balancer or reverse proxy)

### ✅ Performance

- [ ] **Enable compression**
  ```typescript
  import compression from 'compression';
  app.use(compression());
  ```

- [ ] **Serve static assets efficiently**
  ```typescript
  import { ServeStaticModule } from '@nestjs/serve-static';

  @Module({
    imports: [
      ServeStaticModule.forRoot({
        rootPath: join(__dirname, '..', 'client'),
        serveRoot: '/assets',
        exclude: ['/api/*', '/auth/*'],  // Don't interfere with API routes
      }),
    ],
  })
  ```

- [ ] **Configure caching headers**
  ```typescript
  // In your NestJS configuration
  app.use((req, res, next) => {
    if (req.path.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
  });
  ```

- [ ] **Use CDN** for static assets (optional but recommended)
- [ ] **Enable streaming SSR** for faster TTFB
  ```typescript
  RenderModule.register({ mode: 'stream' })
  ```

### ✅ Monitoring and Logging

- [ ] **Configure logging** (Winston, Pino, or NestJS Logger)
  ```typescript
  const logger = app.get(Logger);
  app.useLogger(logger);
  ```

- [ ] **Log errors** but don't expose stack traces to users
  ```typescript
  @Catch()
  export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();

      // Log full error internally
      this.logger.error(exception);

      // Send safe error to client
      response.status(500).json({
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }
  ```

- [ ] **Health check endpoint**
  ```typescript
  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
  ```

- [ ] **Monitor SSR rendering performance**
- [ ] **Set up error tracking** (Sentry, Datadog, etc.) - coming in v0.2.0
- [ ] **Monitor memory usage** and set limits

### ✅ Database and Data

- [ ] **Run migrations** before deployment
- [ ] **Use connection pooling**
- [ ] **Set up database backups**
- [ ] **Test failover scenarios**

### ✅ Testing

- [ ] **Run all tests** before deploying
  ```bash
  npm test
  npm run test:e2e
  ```

- [ ] **Test critical user flows** manually
- [ ] **Verify SSR hydration** works correctly
- [ ] **Test with JavaScript disabled** (progressive enhancement)
- [ ] **Load testing** with realistic traffic

## Deployment Options

### Option 1: Traditional VPS/VM (DigitalOcean, AWS EC2, etc.)

**Setup:**
1. Install Node.js 18+
2. Clone repository or upload build artifacts
3. Install production dependencies: `npm ci --production`
4. Use PM2 or systemd to manage process
5. Configure reverse proxy (nginx/Apache)

**PM2 example:**
```bash
npm install -g pm2
pm2 start dist/main.js --name "nestjs-ssr" -i max
pm2 save
pm2 startup
```

**nginx config:**
```nginx
server {
  listen 80;
  server_name yourapp.com;

  # Proxy to NestJS
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  # Serve static assets directly (optional optimization)
  location /assets/ {
    alias /path/to/app/dist/client/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

### Option 2: Docker

**Dockerfile:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/main"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
    restart: unless-stopped
```

### Option 3: Platform as a Service (Heroku, Render, Railway)

**Required files:**

`Procfile`:
```
web: node dist/main
```

`package.json` scripts:
```json
{
  "scripts": {
    "build": "npm run build:client && npm run build:server && nest build",
    "start": "node dist/main",
    "postinstall": "npm run build"  // For Heroku
  }
}
```

Deploy: `git push heroku main` or connect via GitHub integration.

### Option 4: Serverless (Advanced)

**Not recommended for v0.1.0** - SSR applications work best with long-running processes. Serverless adds cold start latency and complexity.

If you must use serverless:
- Use AWS Lambda with Application Load Balancer
- Increase memory allocation (1024MB+)
- Consider Lambda SnapStart or provisioned concurrency
- Test cold start performance thoroughly

## Post-Deployment Checklist

### ✅ Immediate Verification

- [ ] **Smoke test** - Visit homepage and critical pages
- [ ] **Check logs** for errors
- [ ] **Verify hydration** - Click interactive elements
- [ ] **Test forms** - Submit a form
- [ ] **Check performance** - Measure TTFB and FCP
- [ ] **Mobile test** - Test on mobile device
- [ ] **SEO check** - View page source, verify meta tags

### ✅ Monitoring Setup

- [ ] **Set up uptime monitoring** (UptimeRobot, Pingdom)
- [ ] **Configure alerts** for errors and downtime
- [ ] **Monitor CPU/memory** usage
- [ ] **Track SSR performance** metrics
- [ ] **Review logs** daily for first week

### ✅ Scaling Preparation

- [ ] **Document deployment process**
- [ ] **Set up staging environment**
- [ ] **Plan rollback strategy**
- [ ] **Configure auto-scaling** (if applicable)
- [ ] **Load balancer setup** for multiple instances

## Common Issues and Solutions

### Issue: High Memory Usage

**Solution:**
- Enable garbage collection: `node --max-old-space-size=512 dist/main`
- Monitor for memory leaks
- Use streaming SSR instead of string mode

### Issue: Slow SSR Rendering

**Solution:**
- Optimize database queries
- Cache expensive computations
- Use Suspense for slow data
- Enable streaming mode
- Profile with Node.js profiler

### Issue: Hydration Mismatches

**Solution:**
- Avoid `Math.random()`, `Date.now()` in SSR
- Use `useEffect` for client-only code
- Ensure server and client render identically
- Check for undefined environment variables

### Issue: Assets Not Loading

**Solution:**
- Verify `dist/client` contains built assets
- Check asset paths in HTML
- Configure CDN or asset prefix correctly
- Ensure CORS headers if using separate domain

## Performance Targets

Aim for these metrics in production:

| Metric | Target | Good | Needs Work |
|--------|--------|------|------------|
| **TTFB** | < 200ms | < 500ms | > 500ms |
| **FCP** | < 1.0s | < 2.0s | > 2.0s |
| **LCP** | < 2.5s | < 4.0s | > 4.0s |
| **Hydration** | < 500ms | < 1.0s | > 1.0s |
| **Memory** | < 256MB | < 512MB | > 512MB |

## Security Hardening

### Additional Measures

1. **Dependency scanning**
   ```bash
   npm audit
   npm audit fix
   ```

2. **Update regularly**
   ```bash
   npm outdated
   npm update
   ```

3. **Secrets management**
   - Use environment variables (never commit secrets)
   - Consider HashiCorp Vault or AWS Secrets Manager
   - Rotate secrets periodically

4. **DDoS protection**
   - Use Cloudflare or AWS Shield
   - Configure rate limiting
   - Monitor traffic patterns

## Rollback Strategy

If deployment fails:

1. **Immediate:** Revert to previous version
   ```bash
   git revert HEAD
   git push
   # Or with PM2:
   pm2 reload ecosystem.config.js --update-env
   ```

2. **Database:** Rollback migrations if needed
3. **Cache:** Clear CDN cache if necessary
4. **Monitoring:** Check for residual issues

## Next Steps

- 📊 [Performance Benchmarking](../performance-test/README.md)
- 🔒 [Security Best Practices](../SECURITY.md)
- 📖 [Architecture Overview](../ARCHITECTURE.md)

---

**Ready to deploy?** Run through this checklist and you'll have a rock-solid production deployment.

**Need help?** Check the [troubleshooting guide](../PRODUCTION_RISKS.md) or [open an issue](https://github.com/georgialexandrov/nestjs-ssr/issues).

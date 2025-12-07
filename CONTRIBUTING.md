# Contributing to NestJS SSR

Thank you for your interest in contributing to NestJS SSR! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended package manager)

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/georgialexandrov/nestjs-ssr.git
   cd nestjs-ssr
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the package**
   ```bash
   pnpm build:package
   ```

4. **Run examples**
   ```bash
   # Minimal example with HMR
   cd examples/minimal
   pnpm dev

   # Full-featured example
   cd examples/full-featured
   pnpm dev
   ```

5. **Run tests**
   ```bash
   # Unit tests for the package
   cd packages/react
   pnpm test

   # Run with coverage
   pnpm test:coverage
   ```

## Project Structure

```
nestjs-ssr/
├── packages/
│   └── react/           # Main npm package
│       ├── src/         # Source code
│       ├── dist/        # Built output
│       └── tests/       # Unit tests
├── examples/            # Example applications
│   ├── minimal/         # Minimal setup
│   ├── minimal-simple/  # Simple mode (no HMR)
│   └── full-featured/   # Advanced features
├── performance-test/    # Performance benchmarks
└── docs/               # Documentation
```

## Making Changes

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for semantic versioning and automated changelog generation.

**Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates
- `ci`: CI/CD configuration changes

**Examples:**
```bash
feat(render): add support for custom error boundaries
fix(vite): resolve HMR issue with nested components
docs(readme): update installation instructions
test(render): add unit tests for RenderService
chore(deps): upgrade @nestjs/common to 10.3.0
```

**Scope (optional):**
- `render`: RenderModule and RenderService
- `vite`: Vite plugin
- `hooks`: React hooks
- `examples`: Example applications
- `docs`: Documentation

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Add tests for new features
   - Update documentation as needed
   - Follow the existing code style

3. **Test your changes**
   ```bash
   # Run tests
   pnpm test

   # Build the package
   pnpm build:package

   # Test with examples
   cd examples/minimal
   pnpm dev
   ```

4. **Commit with semantic commit messages**
   ```bash
   git add .
   git commit -m "feat(render): add your feature description"
   ```

5. **Push and create a pull request**
   ```bash
   git push origin feat/your-feature-name
   ```

6. **PR Guidelines**
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure CI checks pass
   - Be responsive to code review feedback

## Development Guidelines

### Code Style

- Use TypeScript for all source code
- Follow existing code formatting (Prettier config)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Testing

- Write unit tests for new features
- Maintain or improve test coverage
- Test edge cases and error conditions
- Use descriptive test names

### Documentation

- Update README if adding user-facing features
- Add JSDoc comments for public APIs
- Update docs/ if changing architecture
- Include code examples for new features

## Reporting Issues

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Code examples or repository links if possible

## Questions?

- Open a [GitHub Discussion](https://github.com/georgialexandrov/nestjs-ssr/discussions)
- Check existing [Issues](https://github.com/georgialexandrov/nestjs-ssr/issues)
- Review the [Documentation](https://github.com/georgialexandrov/nestjs-ssr/tree/main/docs)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

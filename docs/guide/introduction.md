# Introduction

This library treats React as a view layer for NestJS applications. Not a framework. Not a full-stack solution. Just the view layer.

Controllers handle routing and orchestration. Services manage business logic and data. React components render UI. Each layer owns its responsibility. Each tests independently.

## Philosophy

**Backend-First Architecture**

NestJS applications have structure: modules organize features, services contain logic, controllers define routes. Adding server-rendered views shouldn't change that.

Views live alongside controllers and services in feature modules. Open a folder, see the complete feature. Controllers, services, and views together. Not scattered across technical layers.

**Clean Boundaries**

Controllers return data objects. Easy to test - assert the values. Components receive props. Easy to test - render and check output. No mixing.

The `@Render` decorator sits between them. Takes data from controller, passes it to component. Type-safe. Cmd+Click from view to controller. Refactor without fear.

**NestJS Patterns Continue**

Familiar patterns. `@Render(Component)` works like `@Render()` decorator from `@nestjs/common`. Dependency injection works. Guards, interceptors, pipes - all work. React integrates as the view layer. Everything else stays the same.

## How It Works

**Request Flow**

A request comes in. NestJS router matches it to a controller method decorated with `@Render(Component)`.

Controller executes. Calls services, applies business logic, transforms data. Returns a plain object.

The `@Render` decorator intercepts the response. Takes the returned object, passes it as props to the React component. Types flow automatically - TypeScript validates controller return matches component props build time.

The decorator also enriches React context with request information (URL, params, query, filtered headers/cookies). Components access this via hooks.

React component gets wrapped with layouts (root → controller → method → page). Hierarchical structure. Each level can add common UI.

React renders server-side. Either streaming (default) or string mode. HTML generated.

HTML sent to browser with embedded state. Page visible immediately. JavaScript loads in background.

React hydrates. Takes over the DOM. Page becomes interactive.

**Development vs Production**

Development mode runs Vite dev server. HMR works. Change a component, see it instantly. No restart needed.

Production mode uses pre-built bundles. Code splitting, tree shaking, asset hashing. Vite manifest tells the server which files to load. Fast, optimized.

# Introduction

NestJS SSR adds React server-side rendering to your NestJS applications. Controllers handle business logic, React components handle rendering.

## Core Principles

**React as View Layer**
React renders views. NestJS handles routing, business logic, and data management. Each layer stays separate with clear responsibilities.

**Architectural Separation**
- Controllers return data objects
- Services contain business logic
- React components receive props and render

**NestJS Patterns**
Continues NestJS conventions - decorators for routing (`@Render`), modules for organization, dependency injection for services.

## How It Works

**Flow breakdown:**

1. **Router receives request** - NestJS router matches URL to controller method
2. **Controller orchestrates** - Fetches data from services, applies business logic
3. **Data flows down** - Controller returns data to the `@Render` decorator
4. **Component renders** - React component receives data as props, returns JSX
5. **HTML generated** - Server renders React to HTML string
6. **Browser receives** - HTML sent to client with embedded state
7. **React hydrates** - JavaScript loads, React takes over, page becomes interactive

## When to Use This

**Good fit:**
- Existing NestJS applications need server-rendered views
- You want explicit routing over file-based conventions
- Backend-first architecture where views integrate into existing structure
- Teams familiar with NestJS patterns

**Consider alternatives:**
- Building a content-focused site where the view layer drives the architecture
- File-based routing and framework conventions match your mental model
- Application complexity lives primarily in the UI

## Next Steps

Ready to get started? Head to the [Installation](/guide/installation) guide.

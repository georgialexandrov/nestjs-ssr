import { Controller, Get } from '@nestjs/common';
import { Render, Layout } from '@nestjs-ssr/react';
import Home from './views/home';
import Dashboard from './views/dashboard';
import MainLayout from './views/layouts/main.layout';
import DashboardLayout from './views/layouts/dashboard.layout';

@Controller()
@Layout(MainLayout, { props: { title: 'NestJS SSR App' } })
export class AppController {
  @Get()
  @Render(Home)
  getHome() {
    return {
      // Page props
      props: {
        message: 'Hello from NestJS SSR!',
        timestamp: new Date().toISOString(),
      },
      // Extend context with user data (available via usePageContext())
      // In a real app, you'd use a custom interceptor or middleware to add this
      // For now, we'll show it in the dashboard example
    };
  }

  @Get('dashboard')
  @Render(Dashboard, {
    layout: DashboardLayout,
    layoutProps: { activeTab: 'overview' },
  })
  getDashboard() {
    // Simulate authenticated user (in real app, this comes from req.user via Passport)
    const currentUser = {
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    };

    // Simulate feature flags (in real app, from a feature flag service)
    const featureFlags = {
      newDashboard: true,
      darkMode: false,
      analytics: true,
    };

    return {
      props: {
        stats: {
          users: 1234,
          revenue: 52890,
          orders: 456,
        },
        // Pass user and feature flags to demonstrate typed context
        // In a real app, you'd extend RenderContext via custom interceptor
        user: currentUser,
        featureFlags,
      },
      // Dynamic layout props that override/extend static decorator props
      layoutProps: {
        title: `${currentUser.name}'s Dashboard`, // Override static title
        subtitle: `Email: ${currentUser.email}`, // Add dynamic subtitle
        lastUpdated: new Date().toLocaleTimeString(), // Add timestamp
      },
    };
  }
}

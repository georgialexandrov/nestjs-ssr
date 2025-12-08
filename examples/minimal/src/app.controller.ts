import { Controller, Get, NotFoundException } from '@nestjs/common';
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
      message: 'Hello from NestJS SSR!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('dashboard')
  @Render(Dashboard, { layout: DashboardLayout, layoutProps: { activeTab: 'overview' } })
  getDashboard() {
    // Simulate fetching user data (e.g., from authentication)
    const currentUser = {
      name: 'John Doe',
      role: 'Admin',
    };

    return {
      props: {
        stats: {
          users: 1234,
          revenue: 52890,
          orders: 456,
        },
      },
      // Dynamic layout props that override/extend static decorator props
      layoutProps: {
        title: `${currentUser.name}'s Dashboard`, // Override static title
        subtitle: `Role: ${currentUser.role}`,     // Add dynamic subtitle
        lastUpdated: new Date().toLocaleTimeString(), // Add timestamp
      },
    };
  }
}

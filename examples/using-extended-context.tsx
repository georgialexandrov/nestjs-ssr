/**
 * Example: Using Extended Context in Your Application
 *
 * This file demonstrates how to use the extended RenderContext
 * after you've defined your custom properties via declaration merging.
 *
 * Prerequisites:
 * 1. You've created the type declaration file (see extending-types.d.ts)
 * 2. Your interceptor populates the custom properties
 */

import React from 'react';
import type { PageProps } from '@nestjs-react-ssr';
import { usePageContext, useParams, useQuery } from '@nestjs-react-ssr';

// =============================================================================
// EXAMPLE 1: Creating Custom Hooks
// =============================================================================

/**
 * Hook to access the current authenticated user.
 * Thanks to declaration merging, TypeScript knows about the 'user' property!
 */
export function useUser() {
  const context = usePageContext();
  return context.user;  // ✅ Fully typed, no type assertion needed!
}

/**
 * Hook to access tenant information.
 */
export function useTenant() {
  const context = usePageContext();
  return context.tenant;  // ✅ Fully typed!
}

/**
 * Hook to get the current locale.
 */
export function useLocale(): string {
  const context = usePageContext();
  return context.locale || 'en';  // ✅ Typed as string
}

/**
 * Hook to check if a feature flag is enabled.
 */
export function useFeature(featureName: string): boolean {
  const context = usePageContext();
  return context.features?.[featureName] || false;
}

/**
 * Hook to check if user has a specific role.
 */
export function useHasRole(role: 'admin' | 'user' | 'moderator'): boolean {
  const user = useUser();
  return user?.roles.includes(role) || false;
}

// =============================================================================
// EXAMPLE 2: Using in Components
// =============================================================================

/**
 * Example: Dashboard component with authentication
 */
interface DashboardData {
  stats: {
    views: number;
    likes: number;
    comments: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    timestamp: string;
  }>;
}

export function Dashboard({ data, context }: PageProps<DashboardData>) {
  // Access via custom hooks
  const user = useUser();
  const tenant = useTenant();
  const hasAnalytics = useFeature('analytics');

  // Or access directly from context
  const locale = context.locale;
  const theme = context.theme;

  if (!user) {
    return <LoginPrompt />;
  }

  return (
    <div className={`dashboard theme-${theme}`}>
      <header>
        <h1>Welcome back, {user.name}!</h1>
        {tenant && (
          <span className="org-badge">
            {tenant.name} ({tenant.plan})
          </span>
        )}
      </header>

      <div className="stats">
        <StatCard label="Views" value={data.stats.views} />
        <StatCard label="Likes" value={data.stats.likes} />
        <StatCard label="Comments" value={data.stats.comments} />
      </div>

      {hasAnalytics && (
        <section className="analytics">
          <h2>Advanced Analytics</h2>
          <p>Premium feature enabled for {tenant?.plan} plan</p>
        </section>
      )}

      <section className="activity">
        <h2>Recent Activity</h2>
        <ActivityList items={data.recentActivity} locale={locale} />
      </section>
    </div>
  );
}

// =============================================================================
// EXAMPLE 3: Role-Based Access Control
// =============================================================================

interface AdminPanelData {
  users: Array<{ id: string; name: string }>;
  settings: Record<string, any>;
}

export function AdminPanel({ data }: PageProps<AdminPanelData>) {
  const user = useUser();
  const isAdmin = useHasRole('admin');

  // Guard: User not logged in
  if (!user) {
    return (
      <div className="access-denied">
        <h1>Authentication Required</h1>
        <p>Please log in to access this page.</p>
        <a href="/login">Go to Login</a>
      </div>
    );
  }

  // Guard: User not an admin
  if (!isAdmin) {
    return (
      <div className="access-denied">
        <h1>Access Denied</h1>
        <p>You need administrator privileges to access this page.</p>
        <p>Your roles: {user.roles.join(', ')}</p>
      </div>
    );
  }

  // Render admin panel
  return (
    <div className="admin-panel">
      <h1>Admin Panel</h1>
      <p>Logged in as: {user.email}</p>

      <section>
        <h2>Users ({data.users.length})</h2>
        <UserList users={data.users} />
      </section>

      <section>
        <h2>Settings</h2>
        <SettingsEditor settings={data.settings} />
      </section>
    </div>
  );
}

// =============================================================================
// EXAMPLE 4: Multi-Tenant Features
// =============================================================================

interface TeamSettingsData {
  members: Array<{ id: string; name: string; role: string }>;
  billing: {
    plan: string;
    usage: number;
    limit: number;
  };
}

export function TeamSettings({ data }: PageProps<TeamSettingsData>) {
  const tenant = useTenant();
  const user = useUser();

  if (!tenant) {
    return <p>No organization context available</p>;
  }

  const isOwner = user?.roles.includes('admin');
  const canUpgrade = tenant.plan !== 'enterprise';
  const usagePercent = (data.billing.usage / data.billing.limit) * 100;

  return (
    <div className="team-settings">
      <header>
        <h1>{tenant.name}</h1>
        <span className="plan-badge">{tenant.plan}</span>
      </header>

      <section className="billing">
        <h2>Plan & Usage</h2>
        <div className="usage-bar">
          <div className="usage-fill" style={{ width: `${usagePercent}%` }} />
        </div>
        <p>
          {data.billing.usage} / {data.billing.limit} users
        </p>

        {canUpgrade && isOwner && (
          <button className="upgrade-btn">Upgrade to {
            tenant.plan === 'free' ? 'Pro' : 'Enterprise'
          }</button>
        )}

        {usagePercent > 80 && (
          <div className="warning">
            ⚠️ You're approaching your user limit
          </div>
        )}
      </section>

      <section className="members">
        <h2>Team Members ({data.members.length})</h2>
        <MemberList members={data.members} canManage={isOwner} />
      </section>
    </div>
  );
}

// =============================================================================
// EXAMPLE 5: Localization
// =============================================================================

interface BlogPostData {
  title: string;
  content: string;
  author: string;
  publishedAt: string;
}

// Translation dictionaries
const translations = {
  en: {
    readTime: 'min read',
    publishedOn: 'Published on',
    by: 'by',
  },
  es: {
    readTime: 'min de lectura',
    publishedOn: 'Publicado el',
    by: 'por',
  },
  fr: {
    readTime: 'min de lecture',
    publishedOn: 'Publié le',
    by: 'par',
  },
} as const;

export function BlogPost({ data, context }: PageProps<BlogPostData>) {
  const locale = useLocale();
  const geo = context.geo;

  // Get translations for current locale
  const t = translations[locale as keyof typeof translations] || translations.en;

  // Format date based on locale
  const publishDate = new Date(data.publishedAt).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const readTime = Math.ceil(data.content.split(' ').length / 200);

  return (
    <article className="blog-post" lang={locale}>
      {geo && (
        <div className="geo-info">
          Reading from {geo.city}, {geo.country}
        </div>
      )}

      <header>
        <h1>{data.title}</h1>
        <div className="meta">
          <span>{t.publishedOn} {publishDate}</span>
          <span>{t.by} {data.author}</span>
          <span>{readTime} {t.readTime}</span>
        </div>
      </header>

      <div className="content" dangerouslySetInnerHTML={{ __html: data.content }} />
    </article>
  );
}

// =============================================================================
// EXAMPLE 6: Feature Flags
// =============================================================================

interface HomePageData {
  featuredPosts: Array<{ id: string; title: string }>;
  announcements: Array<{ id: string; message: string }>;
}

export function HomePage({ data }: PageProps<HomePageData>) {
  const hasBetaUI = useFeature('betaFeatures');
  const hasAI = useFeature('aiAssistant');

  return (
    <div className="home-page">
      <h1>Welcome to Our Platform</h1>

      {/* Show new UI for beta testers */}
      {hasBetaUI ? (
        <NewFeaturedSection posts={data.featuredPosts} />
      ) : (
        <LegacyFeaturedSection posts={data.featuredPosts} />
      )}

      {/* AI assistant only for users with the feature enabled */}
      {hasAI && (
        <aside className="ai-assistant">
          <AIChat />
        </aside>
      )}

      <section className="announcements">
        {data.announcements.map(announcement => (
          <AnnouncementCard key={announcement.id} {...announcement} />
        ))}
      </section>
    </div>
  );
}

// =============================================================================
// Dummy Components (for completeness)
// =============================================================================

function LoginPrompt() {
  return <div>Please log in</div>;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function ActivityList({ items, locale }: { items: any[]; locale: string }) {
  return <div>Activity list</div>;
}

function UserList({ users }: { users: any[] }) {
  return <div>User list</div>;
}

function SettingsEditor({ settings }: { settings: any }) {
  return <div>Settings editor</div>;
}

function MemberList({ members, canManage }: { members: any[]; canManage?: boolean }) {
  return <div>Member list</div>;
}

function NewFeaturedSection({ posts }: { posts: any[] }) {
  return <div>New UI</div>;
}

function LegacyFeaturedSection({ posts }: { posts: any[] }) {
  return <div>Legacy UI</div>;
}

function AIChat() {
  return <div>AI Chat</div>;
}

function AnnouncementCard(props: any) {
  return <div>Announcement</div>;
}

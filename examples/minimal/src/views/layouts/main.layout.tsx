import type { LayoutProps } from '@nestjs-ssr/react';

interface MainLayoutProps {
  title?: string;
  subtitle?: string;
  description?: string;
}

export default function MainLayout({
  children,
  layoutProps,
}: LayoutProps<MainLayoutProps>) {
  const title = layoutProps?.title || 'NestJS SSR App';
  const subtitle = layoutProps?.subtitle;

  return (
    <>
      <style>{`
        body {
          margin: 0;
          font-family: system-ui, -apple-system, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .layout-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        header {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 1rem 2rem;
          color: white;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        header h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
        }
        header .subtitle {
          margin: 0.25rem 0 0 0;
          font-size: 0.875rem;
          opacity: 0.9;
        }
        main {
          flex: 1;
          padding: 2rem;
        }
        footer {
          background: rgba(0, 0, 0, 0.2);
          padding: 1rem 2rem;
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
      <div className="layout-container">
        <header>
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </header>
        <main>{children}</main>
        <footer>
          <p>Powered by NestJS SSR &copy; 2024</p>
        </footer>
      </div>
    </>
  );
}

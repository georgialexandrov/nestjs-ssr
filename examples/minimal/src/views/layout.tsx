import type { LayoutProps } from '@nestjs-ssr/react';

interface RootLayoutProps {
  lang?: string;
  theme?: string;
}

/**
 * Root Layout - Automatically applied to all pages
 *
 * This is the outermost layout that wraps everything.
 * Place global styles, providers, or HTML attributes here.
 */
export default function RootLayout({
  children,
  layoutProps,
}: LayoutProps<RootLayoutProps>) {
  const lang = layoutProps?.lang || 'en';
  const theme = layoutProps?.theme || 'light';

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Global theme variables */
        :root {
          --theme: ${theme};
        }
      `}</style>

      <div className="root-layout" data-lang={lang} data-theme={theme}>
        {children}
      </div>
    </>
  );
}

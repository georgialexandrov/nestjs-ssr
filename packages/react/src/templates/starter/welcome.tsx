import { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';

interface WelcomeProps {
  renderedAt: string;
}

const styles = `
.welcome h1 { font-size: clamp(2rem, 5vw, 3rem); line-height: 1.1; letter-spacing: -0.03em; margin: 2rem 0 .75rem; }
.welcome .lead { color: var(--muted); font-size: 1.15rem; max-width: 40rem; margin: 0 0 2rem; }
.welcome .flow { list-style: none; padding: 0; margin: 0 0 2rem; display: grid; gap: .75rem;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); counter-reset: step; }
.welcome .flow li { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 1rem; counter-increment: step; }
.welcome .flow li::before { content: counter(step); display: inline-grid; place-items: center;
  width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--accent);
  color: var(--accent-contrast); font-size: .85rem; font-weight: 700; margin-bottom: .5rem; }
.welcome .flow strong { display: block; }
.welcome .flow span { color: var(--muted); font-size: .95rem; }
.welcome code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; overflow-wrap: anywhere;
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: .05rem .35rem; }
.welcome .try { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  border: 1px dashed var(--border); border-radius: 12px; padding: 1rem; margin-bottom: 2rem; }
.welcome .try button { font: inherit; cursor: pointer; border: 0; border-radius: 8px;
  padding: .5rem 1rem; background: var(--accent); color: var(--accent-contrast); font-weight: 600; }
.welcome .links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
`;

/**
 * The page `WelcomeController` renders at /welcome. Edit it and save: with
 * `start:dev` running, the change appears without restarting Nest.
 */
export default function Welcome({ renderedAt }: PageProps<WelcomeProps>) {
  const [clicks, setClicks] = useState(0);

  return (
    <div className="welcome">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <h1>Your NestJS app renders React.</h1>
      <p className="lead">
        This page was rendered on the server at{' '}
        <code>{new Date(renderedAt).toLocaleTimeString('en-US')}</code> and then
        hydrated in your browser.
      </p>

      <ol className="flow">
        <li>
          <strong>A controller returns data</strong>
          <span>
            <code>src/welcome.controller.ts</code> returns{' '}
            <code>{'{ renderedAt }'}</code>.
          </span>
        </li>
        <li>
          <strong>@Render picks the view</strong>
          <span>
            <code>@Render(Welcome)</code> maps it to{' '}
            <code>src/views/welcome.tsx</code>.
          </span>
        </li>
        <li>
          <strong>Nest renders HTML</strong>
          <span>
            The data arrives as typed props; the layout wraps the page.
          </span>
        </li>
        <li>
          <strong>React hydrates</strong>
          <span>The same component takes over in the browser.</span>
        </li>
      </ol>

      <div className="try">
        <button type="button" onClick={() => setClicks((n) => n + 1)}>
          Clicked {clicks} {clicks === 1 ? 'time' : 'times'}
        </button>
        <span>This button only works because the page hydrated.</span>
      </div>

      <div className="links">
        <a href="https://georgialexandrov.github.io/nestjs-ssr/">
          Documentation
        </a>
        <a href="https://github.com/georgialexandrov/nestjs-ssr">GitHub</a>
      </div>
    </div>
  );
}

Welcome.displayName = 'Welcome';

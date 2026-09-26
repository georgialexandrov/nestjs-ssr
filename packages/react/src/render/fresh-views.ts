import { readdirSync, type Dirent } from 'fs';
import { join, relative } from 'path';
import type { ViteDevServer } from 'vite';
import type {
  AnyComponent,
  RenderPayload,
} from '../interfaces/component.interface';
import { getComponentName } from './component-name.util';

/**
 * Development-only: render the current source of a view instead of the copy
 * the controller imported when Nest started.
 *
 * Enabled by `nestjs-ssr dev` (NESTJS_SSR_FRESH_VIEWS=1), which does not
 * restart Nest when only views change. The controller's `@Render(Component)`
 * still names the page; the component itself is loaded through Vite, which
 * always serves the file's latest content. A view is found by the naming
 * convention the client uses (`RecipeList` <-> `recipe-list.tsx`) and used
 * only when it carries exactly the controller component's name; otherwise
 * the controller's component renders, as it always did.
 */
export class FreshViews {
  private files: string[] | undefined;

  constructor(
    private readonly vite: ViteDevServer,
    private readonly sourceRoot: string,
    private readonly viteRoot: string,
  ) {}

  /** Whether this loader belongs to the given (current) Vite server. */
  isFor(vite: ViteDevServer | null): boolean {
    return this.vite === vite;
  }

  static enabled(): boolean {
    return process.env.NESTJS_SSR_FRESH_VIEWS === '1';
  }

  async component(component: AnyComponent): Promise<AnyComponent> {
    const name = getComponentName(component, '');
    if (!name) return component;
    const lower = name.toLowerCase();
    for (const refresh of [false, true]) {
      for (const file of this.viewFiles(refresh)) {
        const stem = (file.split('/').pop() ?? '').replace(/\.tsx?$/, '');
        const pascal = stem.replace(/(^|-)([a-z])/g, (_, __, c: string) =>
          c.toUpperCase(),
        );
        if (pascal !== name && stem.toLowerCase() !== lower) continue;
        const module = (await this.vite.ssrLoadModule(`/${file}`)) as {
          default?: AnyComponent;
        };
        if (module.default && getComponentName(module.default, '') === name) {
          return module.default;
        }
      }
    }
    return component;
  }

  async payload(data: RenderPayload): Promise<RenderPayload> {
    const layouts = data.__layouts;
    if (!layouts?.length) return data;
    return {
      ...data,
      __layouts: await Promise.all(
        layouts.map(async (entry) => ({
          ...entry,
          layout: await this.component(entry.layout),
        })),
      ),
    };
  }

  /** View source files, relative to the Vite root, POSIX separators. */
  private viewFiles(refresh: boolean): string[] {
    if (this.files && !refresh) return this.files;
    const found: string[] = [];
    const walk = (dir: string, inViews: boolean) => {
      let entries: Dirent[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path, inViews || entry.name === 'views');
        } else if (
          inViews &&
          /\.tsx?$/.test(entry.name) &&
          !entry.name.startsWith('entry-')
        ) {
          found.push(relative(this.viteRoot, path).split('\\').join('/'));
        }
      }
    };
    walk(this.sourceRoot, false);
    this.files = found;
    return found;
  }
}

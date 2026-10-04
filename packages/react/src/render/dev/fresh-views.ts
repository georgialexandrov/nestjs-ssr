import { Logger } from '@nestjs/common';
import type { ViteDevServer } from 'vite';
import type {
  AnyComponent,
  RenderPayload,
} from '../../interfaces/component.interface';
import { getComponentName } from '../component-name.util';
import { scanViewNames, type ViewNameIndex } from '../../vite/view-names';

/**
 * Development-only: render the current source of a view instead of the copy
 * the controller imported when Nest started.
 *
 * Enabled by `nestjs-ssr dev` (NESTJS_SSR_FRESH_VIEWS=1), which does not
 * restart Nest when only views change. The controller's `@Render(Component)`
 * still names the page; the component itself is loaded through Vite, which
 * always serves the file's latest content.
 *
 * A view is found by its component name, from an index of the default
 * exports of every view file, so its file can be called anything. The file
 * found for a controller's component is remembered, so renaming the
 * component in the source keeps rendering the edited file rather than the
 * stale import.
 */
export class FreshViews {
  private readonly logger = new Logger('FreshViews');
  private index: ViewNameIndex | undefined;
  private readonly files = new WeakMap<object, string>();
  /** Components no view file could be found for; not looked up again. */
  private readonly unresolved = new WeakSet<object>();
  private readonly warned = new Set<string>();

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
    const key = component as unknown as object;
    let file = this.files.get(key);
    if (!file) {
      if (this.unresolved.has(key)) return component;
      const name = getComponentName(component, '');
      // A new view file or a name changed since the last scan: rescan once.
      file = name
        ? (this.fileFor(name, false) ?? this.fileFor(name, true))
        : undefined;
      if (!file) {
        this.unresolved.add(key);
        return component;
      }
      this.files.set(key, file);
    }
    const module = (await this.vite.ssrLoadModule(`/${file}`)) as {
      default?: AnyComponent;
    };
    return module.default ?? component;
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

  private fileFor(name: string, refresh: boolean): string | undefined {
    if (!this.index || refresh) {
      this.index = scanViewNames(this.sourceRoot, this.viteRoot);
    }
    const files = this.index[name];
    if (files?.length === 1) return files[0];
    if (refresh) this.warnOnce(name, files);
    return undefined;
  }

  private warnOnce(name: string, files: string[] | undefined): void {
    if (this.warned.has(name)) return;
    this.warned.add(name);
    this.logger.warn(
      files?.length
        ? `Several views export a component named ${name} (${files.join(', ')}); ` +
            'edits to them need a Nest restart to reach server rendering. Give each a unique name.'
        : `No view file default-exports a component named ${name}; ` +
            'edits to it need a Nest restart to reach server rendering. ' +
            'Export the page as `export default function ' +
            name +
            '` (or `export default ' +
            name +
            '`).',
    );
  }
}

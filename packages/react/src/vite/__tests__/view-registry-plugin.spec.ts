import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Hoist mock functions so they're available in vi.mock() factories
const { mockWriteFileSync, mockExistsSync, mockMkdirSync, mockReadFileSync, mockCopyFileSync, mockGlob } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockCopyFileSync: vi.fn(),
  mockGlob: vi.fn(),
}));

// Mock fs and glob before imports
vi.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
  copyFileSync: mockCopyFileSync,
  default: {
    writeFileSync: mockWriteFileSync,
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readFileSync: mockReadFileSync,
    copyFileSync: mockCopyFileSync,
  },
}));

vi.mock('glob', () => ({
  glob: mockGlob,
  default: {
    glob: mockGlob,
  },
}));

import { viewRegistryPlugin } from '../view-registry-plugin';

describe('viewRegistryPlugin', () => {
  let consoleLogSpy: ReturnType<typeof vi.fn>;
  let consoleWarnSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockGlob.mockResolvedValue([]);
    mockExistsSync.mockReturnValue(true); // Assume files exist by default
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockReturnValue('// template content');
    mockCopyFileSync.mockReturnValue(undefined);

    // Spy on console
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset env
    delete process.env.VITE_MIDDLEWARE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('plugin interface', () => {
    it('should return a valid Vite plugin', () => {
      const plugin = viewRegistryPlugin();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('view-registry');
      expect(plugin.buildStart).toBeDefined();
      expect(plugin.configureServer).toBeDefined();
      expect(plugin.buildEnd).toBeDefined();
    });
  });

  describe('registry generation', () => {
    it('should generate registry for single view file', async () => {
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      expect(mockWriteFileSync).toHaveBeenCalled();
      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // Check imports
      expect(generatedContent).toContain("import AppViewsHome from '../app/views/home'");

      // Check registry entry
      expect(generatedContent).toContain("'app/views/home': AppViewsHome");

      // Check type augmentation
      expect(generatedContent).toContain("'app/views/home': true");

      // Check helper functions
      expect(generatedContent).toContain('export function getRegisteredViews()');
      expect(generatedContent).toContain('export function isViewRegistered');
    });

    it('should generate registry for multiple view files', async () => {
      mockGlob.mockResolvedValue([
        'app/views/home.tsx',
        'app/views/about.tsx',
        'blog/views/post.tsx',
      ]);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // Check all imports
      expect(generatedContent).toContain("import AppViewsHome from '../app/views/home'");
      expect(generatedContent).toContain("import AppViewsAbout from '../app/views/about'");
      expect(generatedContent).toContain("import BlogViewsPost from '../blog/views/post'");

      // Check all registry entries
      expect(generatedContent).toContain("'app/views/home': AppViewsHome");
      expect(generatedContent).toContain("'app/views/about': AppViewsAbout");
      expect(generatedContent).toContain("'blog/views/post': BlogViewsPost");
    });

    it('should convert hyphens to underscores in component names', async () => {
      mockGlob.mockResolvedValue([
        'user-profile/views/edit-profile.tsx',
      ]);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // Hyphens should be converted to underscores then PascalCase
      expect(generatedContent).toContain('import UserProfileViewsEditProfile');
      expect(generatedContent).toContain("'user-profile/views/edit-profile': UserProfileViewsEditProfile");
    });

    it('should handle nested paths correctly', async () => {
      mockGlob.mockResolvedValue([
        'admin/dashboard/views/stats.tsx',
      ]);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      expect(generatedContent).toContain('import AdminDashboardViewsStats');
      expect(generatedContent).toContain("'admin/dashboard/views/stats': AdminDashboardViewsStats");
    });

    it('should warn when no view files found', async () => {
      mockGlob.mockResolvedValue([]);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[view-registry] No view files found in src/**/views/*.tsx'
      );
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should log count of generated views', async () => {
      mockGlob.mockResolvedValue([
        'app/views/home.tsx',
        'app/views/about.tsx',
        'blog/views/post.tsx',
      ]);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[view-registry] Generated registry with 3 views'
      );
    });

    it('should handle single view count message correctly', async () => {
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[view-registry] Generated registry with 1 view'
      );
    });
  });

  describe('generated code structure', () => {
    it('should include auto-generated warning comment', async () => {
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      expect(generatedContent).toContain('AUTO-GENERATED FILE - DO NOT EDIT');
      expect(generatedContent).toContain('This file is automatically generated by the view-registry-plugin');
    });

    it('should export viewRegistry object', async () => {
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      expect(generatedContent).toContain('export const viewRegistry: Record<string, React.ComponentType<any>> = {');
    });

    it('should export ViewPath type', async () => {
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      expect(generatedContent).toContain('export type ViewPath = keyof typeof viewRegistry');
    });

    it('should include module augmentation for type safety', async () => {
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      expect(generatedContent).toContain("declare module '@nestjs-ssr/react' {");
      expect(generatedContent).toContain('interface ViewPaths {');
    });
  });

  describe('middleware mode', () => {
    it('should skip generation in SSR middleware mode during buildStart', async () => {
      process.env.VITE_MIDDLEWARE = 'true';
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      expect(mockGlob).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should skip watcher setup in SSR middleware mode', () => {
      process.env.VITE_MIDDLEWARE = 'true';

      const plugin = viewRegistryPlugin();
      const mockServer = {
        watcher: {
          on: vi.fn(),
        },
        moduleGraph: {
          getModuleById: vi.fn(),
          invalidateModule: vi.fn(),
        },
        ws: {
          send: vi.fn(),
        },
      };

      plugin.configureServer!(mockServer as any);

      // Watcher should not be configured
      expect(mockServer.watcher.on).not.toHaveBeenCalled();
    });

    it('should generate during buildEnd even in middleware mode', async () => {
      process.env.VITE_MIDDLEWARE = 'true';
      mockGlob.mockResolvedValue(['app/views/home.tsx']);

      const plugin = viewRegistryPlugin();
      await plugin.buildEnd!.call({} as any);

      expect(mockGlob).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log and throw error on glob failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const globError = new Error('Glob failed');
      mockGlob.mockRejectedValue(globError);

      const plugin = viewRegistryPlugin();

      await expect(plugin.buildStart!.call({} as any)).rejects.toThrow('Glob failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[view-registry] Failed to generate registry:',
        globError
      );
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical NestJS module structure', async () => {
      mockGlob.mockResolvedValue([
        'users/views/list.tsx',
        'users/views/profile.tsx',
        'auth/views/login.tsx',
        'auth/views/register.tsx',
        'dashboard/views/home.tsx',
      ]);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      // Check typical module views are registered
      expect(generatedContent).toContain("'users/views/list': UsersViewsList");
      expect(generatedContent).toContain("'users/views/profile': UsersViewsProfile");
      expect(generatedContent).toContain("'auth/views/login': AuthViewsLogin");
      expect(generatedContent).toContain("'auth/views/register': AuthViewsRegister");
      expect(generatedContent).toContain("'dashboard/views/home': DashboardViewsHome");
    });

    it('should handle e-commerce app structure', async () => {
      mockGlob.mockResolvedValue([
        'products/views/list.tsx',
        'products/views/detail.tsx',
        'cart/views/checkout.tsx',
        'orders/views/confirmation.tsx',
      ]);

      const plugin = viewRegistryPlugin();
      await plugin.buildStart!.call({} as any);

      const generatedContent = mockWriteFileSync.mock.calls[0][1] as string;

      expect(generatedContent).toContain("'products/views/list': ProductsViewsList");
      expect(generatedContent).toContain("'products/views/detail': ProductsViewsDetail");
      expect(generatedContent).toContain("'cart/views/checkout': CartViewsCheckout");
      expect(generatedContent).toContain("'orders/views/confirmation': OrdersViewsConfirmation");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[view-registry] Generated registry with 4 views'
      );
    });
  });
});

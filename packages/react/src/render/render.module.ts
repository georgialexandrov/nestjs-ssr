import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RenderService } from './render.service';
import { RenderInterceptor } from './render.interceptor';
import { TemplateParserService } from './template-parser.service';
import { StreamingErrorHandler } from './streaming-error-handler';
import { ViteInitializerService } from './vite-initializer.service';
import type { RenderConfig } from '../interfaces';

@Global()
@Module({
  providers: [
    RenderService,
    TemplateParserService,
    StreamingErrorHandler,
    ViteInitializerService, // Auto-initializes Vite in development (embedded mode by default)
    {
      provide: APP_INTERCEPTOR,
      useClass: RenderInterceptor,
    },
    {
      provide: 'VITE_CONFIG',
      useValue: {}, // Empty config = embedded mode (default)
    },
  ],
  exports: [RenderService],
})
export class RenderModule {
  /**
   * Register the render module with optional configuration
   *
   * @param config - Optional render configuration
   * @returns Dynamic module
   *
   * @example
   * ```ts
   * // Zero config - embedded mode by default (simplest)
   * @Module({
   *   imports: [RenderModule],
   * })
   *
   * // Enable HMR with proxy mode
   * @Module({
   *   imports: [
   *     RenderModule.register({
   *       vite: { mode: 'proxy', port: 5173 }
   *     })
   *   ],
   * })
   *
   * // Enable streaming SSR
   * RenderModule.register({ mode: 'stream' })
   *
   * // Custom error pages
   * RenderModule.register({
   *   mode: 'stream',
   *   errorPageDevelopment: MyCustomDevErrorPage,
   *   errorPageProduction: MyCustomProdErrorPage,
   * })
   * ```
   */
  static register(config?: RenderConfig): DynamicModule {
    const providers: Provider[] = [
      RenderService,
      TemplateParserService,
      StreamingErrorHandler,
      ViteInitializerService, // Auto-initializes Vite in development
      {
        provide: APP_INTERCEPTOR,
        useClass: RenderInterceptor,
      },
    ];

    // Add Vite configuration (defaults applied in ViteInitializerService)
    providers.push({
      provide: 'VITE_CONFIG',
      useValue: config?.vite || {},
    });

    // Add SSR mode configuration if provided
    if (config?.mode) {
      providers.push({
        provide: 'SSR_MODE',
        useValue: config.mode,
      });
    }

    // Add custom error page components if provided
    if (config?.errorPageDevelopment) {
      providers.push({
        provide: 'ERROR_PAGE_DEVELOPMENT',
        useValue: config.errorPageDevelopment,
      });
    }

    if (config?.errorPageProduction) {
      providers.push({
        provide: 'ERROR_PAGE_PRODUCTION',
        useValue: config.errorPageProduction,
      });
    }

    // Add default head configuration if provided
    if (config?.defaultHead) {
      providers.push({
        provide: 'DEFAULT_HEAD',
        useValue: config.defaultHead,
      });
    }

    // Add custom template if provided
    if (config?.template) {
      providers.push({
        provide: 'CUSTOM_TEMPLATE',
        useValue: config.template,
      });
    }

    return {
      global: true,
      module: RenderModule,
      providers,
      exports: [RenderService],
    };
  }

  /**
   * Register the render module asynchronously with dynamic configuration
   *
   * Use this when you need to inject services (e.g., load config from database)
   *
   * @param options - Async configuration options
   * @returns Dynamic module
   *
   * @example
   * ```ts
   * // Load default head from database
   * RenderModule.registerAsync({
   *   imports: [TenantModule],
   *   inject: [TenantRepository],
   *   useFactory: async (tenantRepo: TenantRepository) => {
   *     const tenant = await tenantRepo.findDefaultTenant();
   *     return {
   *       defaultHead: {
   *         title: tenant.appName,
   *         description: tenant.description,
   *         links: [
   *           { rel: 'icon', href: tenant.favicon }
   *         ]
   *       }
   *     };
   *   }
   * })
   * ```
   */
  static registerAsync(options: {
    imports?: any[];
    inject?: any[];
    useFactory: (...args: any[]) => Promise<RenderConfig> | RenderConfig;
  }): DynamicModule {
    const configProvider: Provider = {
      provide: 'RENDER_CONFIG',
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const providers: Provider[] = [
      configProvider,
      RenderService,
      TemplateParserService,
      StreamingErrorHandler,
      ViteInitializerService, // Auto-initializes Vite in development
      {
        provide: APP_INTERCEPTOR,
        useClass: RenderInterceptor,
      },
      // Vite configuration provider - reads from config
      {
        provide: 'VITE_CONFIG',
        useFactory: (config: RenderConfig) => config?.vite || {},
        inject: ['RENDER_CONFIG'],
      },
      // SSR mode provider - reads from config
      {
        provide: 'SSR_MODE',
        useFactory: (config: RenderConfig) => config?.mode,
        inject: ['RENDER_CONFIG'],
      },
      // Error page providers - read from config
      {
        provide: 'ERROR_PAGE_DEVELOPMENT',
        useFactory: (config: RenderConfig) => config?.errorPageDevelopment,
        inject: ['RENDER_CONFIG'],
      },
      {
        provide: 'ERROR_PAGE_PRODUCTION',
        useFactory: (config: RenderConfig) => config?.errorPageProduction,
        inject: ['RENDER_CONFIG'],
      },
      // Default head provider - reads from config
      {
        provide: 'DEFAULT_HEAD',
        useFactory: (config: RenderConfig) => config?.defaultHead,
        inject: ['RENDER_CONFIG'],
      },
      // Custom template provider - reads from config
      {
        provide: 'CUSTOM_TEMPLATE',
        useFactory: (config: RenderConfig) => config?.template,
        inject: ['RENDER_CONFIG'],
      },
    ];

    return {
      global: true,
      module: RenderModule,
      imports: options.imports || [],
      providers,
      exports: [RenderService],
    };
  }
}

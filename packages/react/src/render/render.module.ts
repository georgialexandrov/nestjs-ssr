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
    ViteInitializerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RenderInterceptor,
    },
    {
      provide: 'VITE_CONFIG',
      useValue: {},
    },
  ],
  exports: [RenderService],
})
export class RenderModule {
  /**
   * Configure the render module
   *
   * @param config - Optional render configuration
   * @returns Dynamic module
   *
   * @example
   * ```ts
   * // Zero config - uses defaults
   * RenderModule.forRoot()
   *
   * // Enable streaming SSR
   * RenderModule.forRoot({ mode: 'stream' })
   *
   * // Enable HMR with proxy mode
   * RenderModule.forRoot({
   *   vite: { mode: 'proxy', port: 5173 }
   * })
   *
   * // Custom error pages
   * RenderModule.forRoot({
   *   errorPageDevelopment: DevErrorPage,
   *   errorPageProduction: ProdErrorPage,
   * })
   * ```
   */
  static forRoot(config?: RenderConfig): DynamicModule {
    const providers: Provider[] = [
      RenderService,
      TemplateParserService,
      StreamingErrorHandler,
      ViteInitializerService,
      {
        provide: APP_INTERCEPTOR,
        useClass: RenderInterceptor,
      },
    ];

    providers.push({
      provide: 'VITE_CONFIG',
      useValue: config?.vite || {},
    });

    if (config?.mode) {
      providers.push({
        provide: 'SSR_MODE',
        useValue: config.mode,
      });
    }

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

    if (config?.defaultHead) {
      providers.push({
        provide: 'DEFAULT_HEAD',
        useValue: config.defaultHead,
      });
    }

    if (config?.template) {
      providers.push({
        provide: 'CUSTOM_TEMPLATE',
        useValue: config.template,
      });
    }

    providers.push({
      provide: 'ALLOWED_HEADERS',
      useValue: config?.allowedHeaders || [],
    });

    providers.push({
      provide: 'ALLOWED_COOKIES',
      useValue: config?.allowedCookies || [],
    });

    return {
      global: true,
      module: RenderModule,
      providers,
      exports: [RenderService],
    };
  }

  /**
   * Configure the render module with async factory
   *
   * Use when configuration depends on other services (database, config service, etc.)
   *
   * @param options - Async configuration options
   * @returns Dynamic module
   *
   * @example
   * ```ts
   * // Load config from ConfigService
   * RenderModule.forRootAsync({
   *   imports: [ConfigModule],
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     mode: config.get('SSR_MODE'),
   *     defaultHead: { title: config.get('APP_NAME') },
   *   }),
   * })
   *
   * // Load from database
   * RenderModule.forRootAsync({
   *   imports: [TenantModule],
   *   inject: [TenantService],
   *   useFactory: async (tenantService: TenantService) => {
   *     const tenant = await tenantService.getCurrent();
   *     return {
   *       defaultHead: {
   *         title: tenant.name,
   *         links: [{ rel: 'icon', href: tenant.favicon }],
   *       },
   *     };
   *   },
   * })
   * ```
   */
  static forRootAsync(options: {
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
      ViteInitializerService,
      {
        provide: APP_INTERCEPTOR,
        useClass: RenderInterceptor,
      },
      {
        provide: 'VITE_CONFIG',
        useFactory: (config: RenderConfig) => config?.vite || {},
        inject: ['RENDER_CONFIG'],
      },
      {
        provide: 'SSR_MODE',
        useFactory: (config: RenderConfig) => config?.mode,
        inject: ['RENDER_CONFIG'],
      },
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
      {
        provide: 'DEFAULT_HEAD',
        useFactory: (config: RenderConfig) => config?.defaultHead,
        inject: ['RENDER_CONFIG'],
      },
      {
        provide: 'CUSTOM_TEMPLATE',
        useFactory: (config: RenderConfig) => config?.template,
        inject: ['RENDER_CONFIG'],
      },
      {
        provide: 'ALLOWED_HEADERS',
        useFactory: (config: RenderConfig) => config?.allowedHeaders || [],
        inject: ['RENDER_CONFIG'],
      },
      {
        provide: 'ALLOWED_COOKIES',
        useFactory: (config: RenderConfig) => config?.allowedCookies || [],
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

  /**
   * @deprecated Use forRoot() instead
   */
  static register(config?: RenderConfig): DynamicModule {
    return this.forRoot(config);
  }

  /**
   * @deprecated Use forRootAsync() instead
   */
  static registerAsync(options: {
    imports?: any[];
    inject?: any[];
    useFactory: (...args: any[]) => Promise<RenderConfig> | RenderConfig;
  }): DynamicModule {
    return this.forRootAsync(options);
  }
}

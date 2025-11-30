import { Global, Module, DynamicModule, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RenderService } from './render.service';
import { RenderInterceptor } from './render.interceptor';
import { TemplateParserService } from './template-parser.service';
import { StreamingErrorHandler } from './streaming-error-handler';
import { MonitoringModule } from '../monitoring/monitoring.module';
import type { RenderConfig } from '../interfaces';

@Global()
@Module({})
export class RenderModule {
  /**
   * Register the render module with optional configuration
   *
   * @param config - Optional render configuration
   * @returns Dynamic module
   *
   * @example
   * ```ts
   * // Default configuration (string mode)
   * RenderModule.register()
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
      {
        provide: APP_INTERCEPTOR,
        useClass: RenderInterceptor,
      },
    ];

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

    return {
      global: true,
      module: RenderModule,
      imports: [MonitoringModule.forRoot()],
      providers,
      exports: [RenderService],
    };
  }
}

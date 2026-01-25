export type { RenderContext } from './render-context.interface';
export type { PageProps } from './page-props.interface';
export type {
  RenderConfig,
  SSRMode,
  ViteConfig,
  TemplateParts,
  StreamCallbacks,
  ErrorPageDevelopmentProps,
  ContextFactory,
} from './render-config.interface';
export type { RenderResponse, HeadData } from './render-response.interface';
export type {
  LayoutProps,
  LayoutComponent,
  PageComponentWithLayout,
} from './layout.interface';
export type { SegmentResponse } from './segment.interface';
export type {
  SSRRequest,
  SSRResponse,
  ExpressLikeRequest,
  ExpressLikeResponse,
  FastifyLikeRequest,
  FastifyLikeResponse,
} from './http-adapters.interface';
export {
  isFastifyResponse,
  isExpressResponse,
  isFastifyRequest,
} from './http-adapters.interface';

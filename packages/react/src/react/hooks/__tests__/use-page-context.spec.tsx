import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  PageContextProvider,
  usePageContext,
  useParams,
  useQuery,
  useUserAgent,
  useAcceptLanguage,
  useReferer
} from '../use-page-context';
import type { RenderContext } from '../../../interfaces';
import React from 'react';

describe('React Hooks', () => {
  const mockContext: RenderContext = {
    url: 'http://localhost:3000/users/123?search=test&sort=date',
    path: '/users/123',
    query: { search: 'test', sort: 'date' },
    params: { id: '123' },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    acceptLanguage: 'en-US,en;q=0.9',
    referer: 'https://google.com',
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PageContextProvider context={mockContext}>{children}</PageContextProvider>
  );

  describe('usePageContext', () => {
    it('should return the full context', () => {
      const { result } = renderHook(() => usePageContext(), { wrapper });

      expect(result.current).toEqual(mockContext);
      expect(result.current.url).toBe('http://localhost:3000/users/123?search=test&sort=date');
      expect(result.current.path).toBe('/users/123');
    });

    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => usePageContext());
      }).toThrow('usePageContext must be used within PageContextProvider');
    });

    it('should provide access to all context properties', () => {
      const { result } = renderHook(() => usePageContext(), { wrapper });

      expect(result.current.query).toBeDefined();
      expect(result.current.params).toBeDefined();
      expect(result.current.userAgent).toBeDefined();
      expect(result.current.acceptLanguage).toBeDefined();
      expect(result.current.referer).toBeDefined();
    });
  });

  describe('useParams', () => {
    it('should return route parameters', () => {
      const { result } = renderHook(() => useParams(), { wrapper });

      expect(result.current).toEqual({ id: '123' });
      expect(result.current.id).toBe('123');
    });

    it('should return empty object when no params', () => {
      const emptyContext: RenderContext = {
        url: 'http://localhost:3000/',
        path: '/',
        query: {},
        params: {},
      };

      const emptyWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={emptyContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useParams(), { wrapper: emptyWrapper });

      expect(result.current).toEqual({});
    });

    it('should handle multiple params', () => {
      const multiParamContext: RenderContext = {
        url: 'http://localhost:3000/org/acme/repos/nestjs-ssr',
        path: '/org/acme/repos/nestjs-ssr',
        query: {},
        params: { org: 'acme', repo: 'nestjs-ssr' },
      };

      const multiWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={multiParamContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useParams(), { wrapper: multiWrapper });

      expect(result.current.org).toBe('acme');
      expect(result.current.repo).toBe('nestjs-ssr');
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useParams());
      }).toThrow('usePageContext must be used within PageContextProvider');
    });
  });

  describe('useQuery', () => {
    it('should return query parameters', () => {
      const { result } = renderHook(() => useQuery(), { wrapper });

      expect(result.current).toEqual({ search: 'test', sort: 'date' });
      expect(result.current.search).toBe('test');
      expect(result.current.sort).toBe('date');
    });

    it('should return empty object when no query params', () => {
      const noQueryContext: RenderContext = {
        url: 'http://localhost:3000/users/123',
        path: '/users/123',
        query: {},
        params: { id: '123' },
      };

      const noQueryWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={noQueryContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), { wrapper: noQueryWrapper });

      expect(result.current).toEqual({});
    });

    it('should handle array query parameters', () => {
      const arrayQueryContext: RenderContext = {
        url: 'http://localhost:3000/search?tags=react&tags=ssr',
        path: '/search',
        query: { tags: ['react', 'ssr'] },
        params: {},
      };

      const arrayWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={arrayQueryContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), { wrapper: arrayWrapper });

      expect(result.current.tags).toEqual(['react', 'ssr']);
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useQuery());
      }).toThrow('usePageContext must be used within PageContextProvider');
    });
  });

  describe('useUserAgent', () => {
    it('should return user agent string', () => {
      const { result } = renderHook(() => useUserAgent(), { wrapper });

      expect(result.current).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    });

    it('should return undefined when not provided', () => {
      const noUAContext: RenderContext = {
        url: 'http://localhost:3000/',
        path: '/',
        query: {},
        params: {},
      };

      const noUAWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={noUAContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useUserAgent(), { wrapper: noUAWrapper });

      expect(result.current).toBeUndefined();
    });

    it('should detect mobile user agents', () => {
      const mobileContext: RenderContext = {
        url: 'http://localhost:3000/',
        path: '/',
        query: {},
        params: {},
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      };

      const mobileWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={mobileContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useUserAgent(), { wrapper: mobileWrapper });

      expect(result.current).toContain('iPhone');
      const isMobile = /Mobile|iPhone|Android/i.test(result.current || '');
      expect(isMobile).toBe(true);
    });
  });

  describe('useAcceptLanguage', () => {
    it('should return accept language header', () => {
      const { result } = renderHook(() => useAcceptLanguage(), { wrapper });

      expect(result.current).toBe('en-US,en;q=0.9');
    });

    it('should return undefined when not provided', () => {
      const noLangContext: RenderContext = {
        url: 'http://localhost:3000/',
        path: '/',
        query: {},
        params: {},
      };

      const noLangWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={noLangContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useAcceptLanguage(), { wrapper: noLangWrapper });

      expect(result.current).toBeUndefined();
    });

    it('should parse different language preferences', () => {
      const multiLangContext: RenderContext = {
        url: 'http://localhost:3000/',
        path: '/',
        query: {},
        params: {},
        acceptLanguage: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      };

      const multiLangWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={multiLangContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useAcceptLanguage(), { wrapper: multiLangWrapper });

      expect(result.current).toBe('fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7');
      expect(result.current).toContain('fr-FR');
    });
  });

  describe('useReferer', () => {
    it('should return referer header', () => {
      const { result } = renderHook(() => useReferer(), { wrapper });

      expect(result.current).toBe('https://google.com');
    });

    it('should return undefined when not provided', () => {
      const noRefContext: RenderContext = {
        url: 'http://localhost:3000/',
        path: '/',
        query: {},
        params: {},
      };

      const noRefWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={noRefContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useReferer(), { wrapper: noRefWrapper });

      expect(result.current).toBeUndefined();
    });

    it('should track different referers', () => {
      const socialRefContext: RenderContext = {
        url: 'http://localhost:3000/article',
        path: '/article',
        query: {},
        params: {},
        referer: 'https://twitter.com/share',
      };

      const socialRefWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={socialRefContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useReferer(), { wrapper: socialRefWrapper });

      expect(result.current).toBe('https://twitter.com/share');
      expect(result.current).toContain('twitter.com');
    });
  });

  describe('PageContextProvider', () => {
    it('should provide context to nested components', () => {
      const TestComponent = () => {
        const context = usePageContext();
        const params = useParams();
        const query = useQuery();

        return {
          contextPath: context.path,
          paramId: params.id,
          querySearch: query.search,
        };
      };

      const { result } = renderHook(() => TestComponent(), { wrapper });

      expect(result.current.contextPath).toBe('/users/123');
      expect(result.current.paramId).toBe('123');
      expect(result.current.querySearch).toBe('test');
    });

    it('should allow nested providers', () => {
      const outerContext: RenderContext = {
        url: 'http://localhost:3000/outer',
        path: '/outer',
        query: {},
        params: { level: 'outer' },
      };

      const innerContext: RenderContext = {
        url: 'http://localhost:3000/inner',
        path: '/inner',
        query: {},
        params: { level: 'inner' },
      };

      const nestedWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={outerContext}>
          <PageContextProvider context={innerContext}>
            {children}
          </PageContextProvider>
        </PageContextProvider>
      );

      const { result } = renderHook(() => useParams(), { wrapper: nestedWrapper });

      // Inner provider should override outer
      expect(result.current.level).toBe('inner');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle pagination query params', () => {
      const paginationContext: RenderContext = {
        url: 'http://localhost:3000/products?page=2&limit=20&sort=price',
        path: '/products',
        query: { page: '2', limit: '20', sort: 'price' },
        params: {},
      };

      const paginationWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={paginationContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), { wrapper: paginationWrapper });

      expect(result.current.page).toBe('2');
      expect(result.current.limit).toBe('20');
      expect(result.current.sort).toBe('price');
    });

    it('should handle nested route params', () => {
      const nestedRouteContext: RenderContext = {
        url: 'http://localhost:3000/orgs/nestjs/repos/core/issues/123',
        path: '/orgs/nestjs/repos/core/issues/123',
        query: {},
        params: { org: 'nestjs', repo: 'core', issueId: '123' },
      };

      const nestedRouteWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={nestedRouteContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useParams(), { wrapper: nestedRouteWrapper });

      expect(result.current.org).toBe('nestjs');
      expect(result.current.repo).toBe('core');
      expect(result.current.issueId).toBe('123');
    });

    it('should handle search with filters', () => {
      const searchContext: RenderContext = {
        url: 'http://localhost:3000/search?q=react&category=tutorials&tags=beginner&tags=ssr',
        path: '/search',
        query: { q: 'react', category: 'tutorials', tags: ['beginner', 'ssr'] },
        params: {},
      };

      const searchWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={searchContext}>{children}</PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), { wrapper: searchWrapper });

      expect(result.current.q).toBe('react');
      expect(result.current.category).toBe('tutorials');
      expect(result.current.tags).toEqual(['beginner', 'ssr']);
    });
  });
});

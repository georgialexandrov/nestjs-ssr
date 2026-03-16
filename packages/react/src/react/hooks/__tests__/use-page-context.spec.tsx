import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PageContextProvider, createSSRHooks } from '../use-page-context';
import type { RenderContext } from '../../../interfaces';
import React from 'react';

// Create hooks using the factory (same pattern users will use)
const {
  usePageContext,
  useParams,
  useQuery,
  useRequest,
  useHeaders,
  useHeader,
  useCookies,
  useCookie,
} = createSSRHooks<RenderContext>();

describe('React Hooks', () => {
  const mockContext: RenderContext = {
    url: 'http://localhost:3000/users/123?search=test&sort=date',
    path: '/users/123',
    query: { search: 'test', sort: 'date' },
    params: { id: '123' },
    method: 'GET',
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PageContextProvider context={mockContext}>{children}</PageContextProvider>
  );

  describe('usePageContext', () => {
    it('should return the full context', () => {
      const { result } = renderHook(() => usePageContext(), { wrapper });

      expect(result.current).toEqual(mockContext);
      expect(result.current.url).toBe(
        'http://localhost:3000/users/123?search=test&sort=date',
      );
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
        method: 'GET',
        query: {},
        params: {},
      };

      const emptyWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={emptyContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useParams(), {
        wrapper: emptyWrapper,
      });

      expect(result.current).toEqual({});
    });

    it('should handle multiple params', () => {
      const multiParamContext: RenderContext = {
        url: 'http://localhost:3000/org/acme/repos/nestjs-ssr',
        path: '/org/acme/repos/nestjs-ssr',
        method: 'GET',
        query: {},
        params: { org: 'acme', repo: 'nestjs-ssr' },
      };

      const multiWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={multiParamContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useParams(), {
        wrapper: multiWrapper,
      });

      expect(result.current.org).toBe('acme');
      expect(result.current.repo).toBe('nestjs-ssr');
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useParams());
      }).toThrow('useParams must be used within PageContextProvider');
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
        method: 'GET',
        query: {},
        params: { id: '123' },
      };

      const noQueryWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={noQueryContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), {
        wrapper: noQueryWrapper,
      });

      expect(result.current).toEqual({});
    });

    it('should handle array query parameters', () => {
      const arrayQueryContext: RenderContext = {
        url: 'http://localhost:3000/search?tags=react&tags=ssr',
        path: '/search',
        method: 'GET',
        query: { tags: ['react', 'ssr'] },
        params: {},
      };

      const arrayWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={arrayQueryContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), {
        wrapper: arrayWrapper,
      });

      expect(result.current.tags).toEqual(['react', 'ssr']);
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useQuery());
      }).toThrow('useQuery must be used within PageContextProvider');
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
        method: 'GET',
        query: {},
        params: { level: 'outer' },
      };

      const innerContext: RenderContext = {
        url: 'http://localhost:3000/inner',
        path: '/inner',
        method: 'GET',
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

      const { result } = renderHook(() => useParams(), {
        wrapper: nestedWrapper,
      });

      // Inner provider should override outer
      expect(result.current.level).toBe('inner');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle pagination query params', () => {
      const paginationContext: RenderContext = {
        url: 'http://localhost:3000/products?page=2&limit=20&sort=price',
        path: '/products',
        method: 'GET',
        query: { page: '2', limit: '20', sort: 'price' },
        params: {},
      };

      const paginationWrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <PageContextProvider context={paginationContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), {
        wrapper: paginationWrapper,
      });

      expect(result.current.page).toBe('2');
      expect(result.current.limit).toBe('20');
      expect(result.current.sort).toBe('price');
    });

    it('should handle nested route params', () => {
      const nestedRouteContext: RenderContext = {
        url: 'http://localhost:3000/orgs/nestjs/repos/core/issues/123',
        path: '/orgs/nestjs/repos/core/issues/123',
        method: 'GET',
        query: {},
        params: { org: 'nestjs', repo: 'core', issueId: '123' },
      };

      const nestedRouteWrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <PageContextProvider context={nestedRouteContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useParams(), {
        wrapper: nestedRouteWrapper,
      });

      expect(result.current.org).toBe('nestjs');
      expect(result.current.repo).toBe('core');
      expect(result.current.issueId).toBe('123');
    });

    it('should handle search with filters', () => {
      const searchContext: RenderContext = {
        url: 'http://localhost:3000/search?q=react&category=tutorials&tags=beginner&tags=ssr',
        path: '/search',
        method: 'GET',
        query: { q: 'react', category: 'tutorials', tags: ['beginner', 'ssr'] },
        params: {},
      };

      const searchWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={searchContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useQuery(), {
        wrapper: searchWrapper,
      });

      expect(result.current.q).toBe('react');
      expect(result.current.category).toBe('tutorials');
      expect(result.current.tags).toEqual(['beginner', 'ssr']);
    });
  });

  describe('useRequest', () => {
    it('should return the full context (alias for usePageContext)', () => {
      const { result } = renderHook(() => useRequest(), { wrapper });

      expect(result.current).toEqual(mockContext);
      expect(result.current.path).toBe('/users/123');
      expect(result.current.method).toBe('GET');
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useRequest());
      }).toThrow('useRequest must be used within PageContextProvider');
    });
  });

  describe('useHeaders', () => {
    it('should extract custom headers (non-base keys with string values)', () => {
      const contextWithHeaders = {
        ...mockContext,
        'user-agent': 'Mozilla/5.0',
        'x-tenant-id': 'tenant-123',
      } as unknown as RenderContext;

      const headersWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={contextWithHeaders}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useHeaders(), {
        wrapper: headersWrapper,
      });

      expect(result.current['user-agent']).toBe('Mozilla/5.0');
      expect(result.current['x-tenant-id']).toBe('tenant-123');
    });

    it('should exclude base RenderContext keys', () => {
      const contextWithHeaders = {
        ...mockContext,
        'x-custom': 'value',
      } as unknown as RenderContext;

      const headersWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={contextWithHeaders}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useHeaders(), {
        wrapper: headersWrapper,
      });

      // Base keys should not appear in headers
      expect(result.current).not.toHaveProperty('url');
      expect(result.current).not.toHaveProperty('path');
      expect(result.current).not.toHaveProperty('query');
      expect(result.current).not.toHaveProperty('params');
      expect(result.current).not.toHaveProperty('method');
      expect(result.current).not.toHaveProperty('cookies');

      // Custom header should be present
      expect(result.current['x-custom']).toBe('value');
    });

    it('should filter out non-string values', () => {
      const contextWithMixed = {
        ...mockContext,
        'x-valid': 'string-value',
        'x-number': 42,
        'x-object': { nested: true },
        'x-array': ['a', 'b'],
        'x-null': null,
        'x-bool': true,
      } as unknown as RenderContext;

      const mixedWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={contextWithMixed}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useHeaders(), {
        wrapper: mixedWrapper,
      });

      expect(result.current['x-valid']).toBe('string-value');
      expect(result.current).not.toHaveProperty('x-number');
      expect(result.current).not.toHaveProperty('x-object');
      expect(result.current).not.toHaveProperty('x-array');
      expect(result.current).not.toHaveProperty('x-null');
      expect(result.current).not.toHaveProperty('x-bool');
    });

    it('should return empty object when no custom headers exist', () => {
      const { result } = renderHook(() => useHeaders(), { wrapper });

      expect(result.current).toEqual({});
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useHeaders());
      }).toThrow('useHeaders must be used within PageContextProvider');
    });
  });

  describe('useHeader', () => {
    const contextWithHeaders = {
      ...mockContext,
      'x-tenant-id': 'tenant-123',
      'accept-language': 'en-US',
    } as unknown as RenderContext;

    const headerWrapper = ({ children }: { children: React.ReactNode }) => (
      <PageContextProvider context={contextWithHeaders}>
        {children}
      </PageContextProvider>
    );

    it('should return the value of a specific header', () => {
      const { result } = renderHook(() => useHeader('x-tenant-id'), {
        wrapper: headerWrapper,
      });

      expect(result.current).toBe('tenant-123');
    });

    it('should return undefined for a non-existent header', () => {
      const { result } = renderHook(() => useHeader('x-missing'), {
        wrapper: headerWrapper,
      });

      expect(result.current).toBeUndefined();
    });

    it('should return undefined for a base key (not treated as header)', () => {
      // useHeader does NOT filter base keys — it reads any string value by name.
      // But base keys like query/params are objects, so they return undefined.
      const { result } = renderHook(() => useHeader('query'), {
        wrapper: headerWrapper,
      });

      // query is an object, not a string — should return undefined
      expect(result.current).toBeUndefined();
    });

    it('should return undefined when value is not a string', () => {
      const contextWithNonString = {
        ...mockContext,
        'x-count': 42,
      } as unknown as RenderContext;

      const nonStringWrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <PageContextProvider context={contextWithNonString}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useHeader('x-count'), {
        wrapper: nonStringWrapper,
      });

      expect(result.current).toBeUndefined();
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useHeader('x-tenant-id'));
      }).toThrow('useHeader must be used within PageContextProvider');
    });
  });

  describe('useCookies', () => {
    const contextWithCookies = {
      ...mockContext,
      cookies: { theme: 'dark', locale: 'en-US', consent: 'accepted' },
    } as unknown as RenderContext;

    const cookiesWrapper = ({ children }: { children: React.ReactNode }) => (
      <PageContextProvider context={contextWithCookies}>
        {children}
      </PageContextProvider>
    );

    it('should return all cookies', () => {
      const { result } = renderHook(() => useCookies(), {
        wrapper: cookiesWrapper,
      });

      expect(result.current).toEqual({
        theme: 'dark',
        locale: 'en-US',
        consent: 'accepted',
      });
    });

    it('should return empty object when no cookies property exists', () => {
      // mockContext has no cookies property
      const { result } = renderHook(() => useCookies(), { wrapper });

      expect(result.current).toEqual({});
    });

    it('should return empty object when cookies is null', () => {
      const nullCookiesContext = {
        ...mockContext,
        cookies: null,
      } as unknown as RenderContext;

      const nullWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={nullCookiesContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useCookies(), {
        wrapper: nullWrapper,
      });

      expect(result.current).toEqual({});
    });

    it('should return empty object when cookies is not an object', () => {
      const stringCookiesContext = {
        ...mockContext,
        cookies: 'not-an-object',
      } as unknown as RenderContext;

      const stringWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={stringCookiesContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useCookies(), {
        wrapper: stringWrapper,
      });

      expect(result.current).toEqual({});
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useCookies());
      }).toThrow('useCookies must be used within PageContextProvider');
    });
  });

  describe('useCookie', () => {
    const contextWithCookies = {
      ...mockContext,
      cookies: { theme: 'dark', locale: 'en-US' },
    } as unknown as RenderContext;

    const cookieWrapper = ({ children }: { children: React.ReactNode }) => (
      <PageContextProvider context={contextWithCookies}>
        {children}
      </PageContextProvider>
    );

    it('should return the value of a specific cookie', () => {
      const { result } = renderHook(() => useCookie('theme'), {
        wrapper: cookieWrapper,
      });

      expect(result.current).toBe('dark');
    });

    it('should return undefined for a non-existent cookie', () => {
      const { result } = renderHook(() => useCookie('session'), {
        wrapper: cookieWrapper,
      });

      expect(result.current).toBeUndefined();
    });

    it('should return undefined when cookies object is missing', () => {
      const { result } = renderHook(() => useCookie('theme'), { wrapper });

      expect(result.current).toBeUndefined();
    });

    it('should return undefined when cookies is null', () => {
      const nullContext = {
        ...mockContext,
        cookies: null,
      } as unknown as RenderContext;

      const nullWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={nullContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useCookie('theme'), {
        wrapper: nullWrapper,
      });

      expect(result.current).toBeUndefined();
    });

    it('should return undefined when cookies is an array', () => {
      const arrayContext = {
        ...mockContext,
        cookies: ['theme=dark'],
      } as unknown as RenderContext;

      const arrayWrapper = ({ children }: { children: React.ReactNode }) => (
        <PageContextProvider context={arrayContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useCookie('theme'), {
        wrapper: arrayWrapper,
      });

      expect(result.current).toBeUndefined();
    });

    it('should return undefined when cookie value is not a string', () => {
      const nonStringCookieContext = {
        ...mockContext,
        cookies: { theme: 42 },
      } as unknown as RenderContext;

      const nonStringWrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <PageContextProvider context={nonStringCookieContext}>
          {children}
        </PageContextProvider>
      );

      const { result } = renderHook(() => useCookie('theme'), {
        wrapper: nonStringWrapper,
      });

      expect(result.current).toBeUndefined();
    });

    it('should throw when used outside provider', () => {
      expect(() => {
        renderHook(() => useCookie('theme'));
      }).toThrow('useCookie must be used within PageContextProvider');
    });
  });
});

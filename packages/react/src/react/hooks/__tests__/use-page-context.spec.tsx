import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PageContextProvider, createSSRHooks } from '../use-page-context';
import type { RenderContext } from '../../../interfaces';
import React from 'react';

// Create hooks using the factory (same pattern users will use)
const { usePageContext, useParams, useQuery, useRequest } =
  createSSRHooks<RenderContext>();

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
});

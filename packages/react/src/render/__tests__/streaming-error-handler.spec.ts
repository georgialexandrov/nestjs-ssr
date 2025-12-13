import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamingErrorHandler } from '../streaming-error-handler';
import type { Response } from 'express';
import type { ComponentType } from 'react';
import type { ErrorPageDevelopmentProps } from '../../interfaces';
import React from 'react';

describe('StreamingErrorHandler', () => {
  let handler: StreamingErrorHandler;
  let mockResponse: Partial<Response>;
  let testError: Error;

  beforeEach(() => {
    handler = new StreamingErrorHandler();
    testError = new Error('Test error message');
    testError.stack = 'Error: Test error\n  at test.ts:10';

    mockResponse = {
      statusCode: 200,
      setHeader: vi.fn(),
      send: vi.fn(),
    };
  });

  describe('handleShellError', () => {
    it('should set 500 status code', () => {
      handler.handleShellError(
        testError,
        mockResponse as Response,
        'views/test',
        false,
      );

      expect(mockResponse.statusCode).toBe(500);
    });

    it('should set content-type header', () => {
      handler.handleShellError(
        testError,
        mockResponse as Response,
        'views/test',
        false,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
    });

    it('should send development error page in development mode', () => {
      handler.handleShellError(
        testError,
        mockResponse as Response,
        'views/test',
        true,
      );

      expect(mockResponse.send).toHaveBeenCalled();
      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      expect(sentHtml).toContain('<!DOCTYPE html>');
      expect(sentHtml).toContain('Test error message');
      expect(sentHtml).toContain('views/test');
    });

    it('should send production error page in production mode', () => {
      handler.handleShellError(
        testError,
        mockResponse as Response,
        'views/test',
        false,
      );

      expect(mockResponse.send).toHaveBeenCalled();
      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      expect(sentHtml).toContain('<!DOCTYPE html>');
      // Production page should NOT expose error details
      expect(sentHtml).not.toContain('Test error message');
      expect(sentHtml).not.toContain('views/test');
    });

    it('should include error stack in development mode', () => {
      handler.handleShellError(
        testError,
        mockResponse as Response,
        'views/test',
        true,
      );

      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      expect(sentHtml).toContain('test.ts:10');
    });

    it('should handle errors with special characters', () => {
      const errorWithHtml = new Error('<script>alert("xss")</script>');

      handler.handleShellError(
        errorWithHtml,
        mockResponse as Response,
        'views/test',
        true,
      );

      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      // React's renderToStaticMarkup should escape HTML
      expect(sentHtml).not.toContain('<script>alert');
    });
  });

  describe('handleStreamError', () => {
    it('should only log error and not throw', () => {
      // This should not throw - headers already sent, can only log
      expect(() => {
        handler.handleStreamError(testError, 'views/test');
      }).not.toThrow();
    });

    it('should handle error during active stream', () => {
      const streamError = new Error('Stream interrupted');

      // Should handle gracefully
      expect(() => {
        handler.handleStreamError(streamError, 'views/user-profile');
      }).not.toThrow();
    });
  });

  describe('custom error pages', () => {
    it('should accept custom development error page component', () => {
      const CustomErrorPage: ComponentType<ErrorPageDevelopmentProps> = () =>
        null;

      // Should not throw when instantiating with custom component
      expect(() => {
        new StreamingErrorHandler(CustomErrorPage);
      }).not.toThrow();
    });

    it('should accept custom production error page component', () => {
      const CustomProductionPage: ComponentType = () => null;

      // Should not throw when instantiating with custom component
      expect(() => {
        new StreamingErrorHandler(undefined, CustomProductionPage);
      }).not.toThrow();
    });

    it('should work without custom error pages', () => {
      // Should use default error pages
      const defaultHandler = new StreamingErrorHandler();

      defaultHandler.handleShellError(
        testError,
        mockResponse as Response,
        'views/test',
        true,
      );

      // Should still send error page
      expect(mockResponse.send).toHaveBeenCalled();
    });
  });

  describe('error scenarios', () => {
    it('should handle error without stack trace', () => {
      const errorNoStack = new Error('Error without stack');
      delete errorNoStack.stack;

      handler.handleShellError(
        errorNoStack,
        mockResponse as Response,
        'views/test',
        true,
      );

      expect(mockResponse.send).toHaveBeenCalled();
      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      expect(sentHtml).toContain('Error without stack');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000);
      const longError = new Error(longMessage);

      handler.handleShellError(
        longError,
        mockResponse as Response,
        'views/test',
        true,
      );

      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should handle error during rendering of error page itself', () => {
      const BrokenErrorPage: ComponentType<ErrorPageDevelopmentProps> = () => {
        throw new Error('Error page is broken');
      };

      const brokenHandler = new StreamingErrorHandler(BrokenErrorPage);

      // Should throw since error page itself is broken
      expect(() => {
        brokenHandler.handleShellError(
          testError,
          mockResponse as Response,
          'views/test',
          true,
        );
      }).toThrow('Error page is broken');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle component not found error', () => {
      const notFoundError = new Error(
        'View "views/nonexistent" not found in registry',
      );

      handler.handleShellError(
        notFoundError,
        mockResponse as Response,
        'views/nonexistent',
        true,
      );

      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      expect(sentHtml).toContain('not found in registry');
      expect(sentHtml).toContain('views/nonexistent');
    });

    it('should handle React rendering error', () => {
      const renderError = new Error('Objects are not valid as a React child');

      handler.handleShellError(
        renderError,
        mockResponse as Response,
        'views/broken-component',
        true,
      );

      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      expect(sentHtml).toContain('Objects are not valid');
    });

    it('should handle database connection error during SSR', () => {
      const dbError = new Error('Connection to database timed out');

      handler.handleShellError(
        dbError,
        mockResponse as Response,
        'views/user-list',
        false,
      );

      // Production should not expose DB error details
      const sentHtml = (mockResponse.send as any).mock.calls[0][0];
      expect(sentHtml).not.toContain('database');
      expect(sentHtml).not.toContain('Connection');
    });

    it('should handle streaming error mid-render', () => {
      const streamError = new Error('Network connection lost');

      // Should not crash - just log
      expect(() => {
        handler.handleStreamError(streamError, 'views/large-page');
      }).not.toThrow();
    });
  });
});

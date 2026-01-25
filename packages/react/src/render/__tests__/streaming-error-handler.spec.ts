import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamingErrorHandler } from '../streaming-error-handler';
import type { ComponentType } from 'react';
import type { ErrorPageDevelopmentProps } from '../../interfaces';
import React from 'react';

describe('StreamingErrorHandler', () => {
  let handler: StreamingErrorHandler;
  let mockResponse: any;
  let testError: Error;

  beforeEach(() => {
    handler = new StreamingErrorHandler();
    testError = new Error('Test error message');
    testError.stack = 'Error: Test error\n  at test.ts:10';

    // Mock raw Node.js ServerResponse (used by both Express and Fastify)
    mockResponse = {
      statusCode: 200,
      headersSent: false,
      writableEnded: false,
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
  });

  describe('handleShellError', () => {
    it('should set 500 status code', () => {
      handler.handleShellError(testError, mockResponse, 'views/test', false);

      expect(mockResponse.statusCode).toBe(500);
    });

    it('should set content-type header', () => {
      handler.handleShellError(testError, mockResponse, 'views/test', false);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
    });

    it('should send development error page in development mode', () => {
      handler.handleShellError(testError, mockResponse, 'views/test', true);

      expect(mockResponse.end).toHaveBeenCalled();
      const sentHtml = mockResponse.end.mock.calls[0][0];
      expect(sentHtml).toContain('<!DOCTYPE html>');
      expect(sentHtml).toContain('Test error message');
      expect(sentHtml).toContain('views/test');
    });

    it('should send production error page in production mode', () => {
      handler.handleShellError(testError, mockResponse, 'views/test', false);

      expect(mockResponse.end).toHaveBeenCalled();
      const sentHtml = mockResponse.end.mock.calls[0][0];
      expect(sentHtml).toContain('<!DOCTYPE html>');
      // Production page should NOT expose error details
      expect(sentHtml).not.toContain('Test error message');
      expect(sentHtml).not.toContain('views/test');
    });

    it('should include error stack in development mode', () => {
      handler.handleShellError(testError, mockResponse, 'views/test', true);

      const sentHtml = mockResponse.end.mock.calls[0][0];
      expect(sentHtml).toContain('test.ts:10');
    });

    it('should handle errors with special characters', () => {
      const errorWithHtml = new Error('<script>alert("xss")</script>');

      handler.handleShellError(errorWithHtml, mockResponse, 'views/test', true);

      const sentHtml = mockResponse.end.mock.calls[0][0];
      // React's renderToStaticMarkup should escape HTML
      expect(sentHtml).not.toContain('<script>alert');
    });

    it('should handle headers already sent (streaming started)', () => {
      const mockResponseWithHeadersSent = {
        headersSent: true,
        writableEnded: false,
        statusCode: 200,
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      handler.handleShellError(
        testError,
        mockResponseWithHeadersSent,
        'views/test',
        true,
      );

      // Should NOT try to set headers
      expect(mockResponseWithHeadersSent.setHeader).not.toHaveBeenCalled();
      // Should write error overlay in development
      expect(mockResponseWithHeadersSent.write).toHaveBeenCalled();
      const writtenHtml = mockResponseWithHeadersSent.write.mock.calls[0][0];
      expect(writtenHtml).toContain('ssr-error-overlay');
      expect(writtenHtml).toContain('SSR Streaming Error');
      expect(writtenHtml).toContain('Test error message');
      expect(writtenHtml).toContain('views/test');
      // Should end the response
      expect(mockResponseWithHeadersSent.end).toHaveBeenCalled();
    });

    it('should show generic error overlay in production when headers sent', () => {
      const mockResponseWithHeadersSent = {
        headersSent: true,
        writableEnded: false,
        statusCode: 200,
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      handler.handleShellError(
        testError,
        mockResponseWithHeadersSent,
        'views/test',
        false, // production mode
      );

      // Should write generic error overlay in production
      expect(mockResponseWithHeadersSent.write).toHaveBeenCalled();
      const writtenHtml = mockResponseWithHeadersSent.write.mock.calls[0][0];
      expect(writtenHtml).toContain('ssr-error-overlay');
      expect(writtenHtml).toContain('Something went wrong');
      // Should NOT expose error details in production
      expect(writtenHtml).not.toContain('Test error message');
      expect(writtenHtml).not.toContain('views/test');
      // Should still end the response
      expect(mockResponseWithHeadersSent.end).toHaveBeenCalled();
    });

    it('should not call end if response already ended', () => {
      const mockResponseEnded = {
        headersSent: true,
        writableEnded: true,
        statusCode: 200,
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      handler.handleShellError(
        testError,
        mockResponseEnded,
        'views/test',
        true,
      );

      // Should NOT call end since response already ended
      expect(mockResponseEnded.end).not.toHaveBeenCalled();
    });

    it('should escape XSS in inline error overlay when headers sent', () => {
      const xssError = new Error('<script>alert("xss")</script>');
      xssError.stack =
        'Error: <img src=x onerror=alert(1)>\n  at malicious.ts:1';

      const mockResponseWithHeadersSent = {
        headersSent: true,
        writableEnded: false,
        statusCode: 200,
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      handler.handleShellError(
        xssError,
        mockResponseWithHeadersSent,
        'views/<script>evil</script>',
        true,
      );

      const writtenHtml = mockResponseWithHeadersSent.write.mock.calls[0][0];

      // Should escape script tags in error message
      expect(writtenHtml).not.toContain('<script>alert');
      expect(writtenHtml).toContain('&lt;script&gt;');

      // Should escape XSS in stack trace
      expect(writtenHtml).not.toContain('<img src=x');
      expect(writtenHtml).toContain('&lt;img');

      // Should escape XSS in view path
      expect(writtenHtml).not.toContain('views/<script>evil');
      expect(writtenHtml).toContain('views/&lt;script&gt;evil');
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
        mockResponse,
        'views/test',
        true,
      );

      // Should still send error page
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('error scenarios', () => {
    it('should handle error without stack trace', () => {
      const errorNoStack = new Error('Error without stack');
      delete errorNoStack.stack;

      handler.handleShellError(errorNoStack, mockResponse, 'views/test', true);

      expect(mockResponse.end).toHaveBeenCalled();
      const sentHtml = mockResponse.end.mock.calls[0][0];
      expect(sentHtml).toContain('Error without stack');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000);
      const longError = new Error(longMessage);

      handler.handleShellError(longError, mockResponse, 'views/test', true);

      expect(mockResponse.end).toHaveBeenCalled();
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
          mockResponse,
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
        mockResponse,
        'views/nonexistent',
        true,
      );

      const sentHtml = mockResponse.end.mock.calls[0][0];
      expect(sentHtml).toContain('not found in registry');
      expect(sentHtml).toContain('views/nonexistent');
    });

    it('should handle React rendering error', () => {
      const renderError = new Error('Objects are not valid as a React child');

      handler.handleShellError(
        renderError,
        mockResponse,
        'views/broken-component',
        true,
      );

      const sentHtml = mockResponse.end.mock.calls[0][0];
      expect(sentHtml).toContain('Objects are not valid');
    });

    it('should handle database connection error during SSR', () => {
      const dbError = new Error('Connection to database timed out');

      handler.handleShellError(dbError, mockResponse, 'views/user-list', false);

      // Production should not expose DB error details
      const sentHtml = mockResponse.end.mock.calls[0][0];
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

  describe('Fastify compatibility', () => {
    it('should handle Fastify response object with raw property', () => {
      // Fastify wraps the response - access via .raw
      const mockFastifyResponse = {
        sent: false, // Fastify uses 'sent' instead of 'headersSent'
        raw: {
          statusCode: 200,
          headersSent: false,
          writableEnded: false,
          setHeader: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn(),
        },
      };

      handler.handleShellError(
        testError,
        mockFastifyResponse,
        'views/test',
        false,
      );

      // Should use raw response
      expect(mockFastifyResponse.raw.statusCode).toBe(500);
      expect(mockFastifyResponse.raw.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html; charset=utf-8',
      );
      expect(mockFastifyResponse.raw.end).toHaveBeenCalled();
    });

    it('should detect headers sent via Fastify sent property', () => {
      const mockFastifyResponseSent = {
        sent: true, // Fastify uses 'sent' instead of 'headersSent'
        raw: {
          statusCode: 200,
          headersSent: true,
          writableEnded: false,
          setHeader: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn(),
        },
      };

      handler.handleShellError(
        testError,
        mockFastifyResponseSent,
        'views/test',
        true,
      );

      // Should NOT try to set headers
      expect(mockFastifyResponseSent.raw.setHeader).not.toHaveBeenCalled();
      // Should write error overlay
      expect(mockFastifyResponseSent.raw.write).toHaveBeenCalled();
    });
  });
});

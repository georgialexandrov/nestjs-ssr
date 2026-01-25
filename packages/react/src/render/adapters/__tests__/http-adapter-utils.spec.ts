import { describe, it, expect, vi } from 'vitest';
import {
  detectAdapterType,
  getRawResponse,
  isHeadersSent,
} from '../http-adapter-utils';

describe('http-adapter-utils', () => {
  describe('detectAdapterType', () => {
    it('should return "unknown" when httpAdapterHost is null', () => {
      expect(detectAdapterType(null)).toBe('unknown');
    });

    it('should return "unknown" when httpAdapterHost is undefined', () => {
      expect(detectAdapterType(undefined)).toBe('unknown');
    });

    it('should return "unknown" when httpAdapter is missing', () => {
      expect(detectAdapterType({})).toBe('unknown');
    });

    it('should return "unknown" when getInstance returns null', () => {
      const mockAdapterHost = {
        httpAdapter: {
          getInstance: () => null,
        },
      };
      expect(detectAdapterType(mockAdapterHost)).toBe('unknown');
    });

    it('should detect Fastify adapter (has register method)', () => {
      const mockAdapterHost = {
        httpAdapter: {
          getInstance: () => ({
            register: vi.fn(), // Fastify-specific
          }),
        },
      };
      expect(detectAdapterType(mockAdapterHost)).toBe('fastify');
    });

    it('should detect Express adapter (has use and get methods)', () => {
      const mockAdapterHost = {
        httpAdapter: {
          getInstance: () => ({
            use: vi.fn(),
            get: vi.fn(),
            // No register method
          }),
        },
      };
      expect(detectAdapterType(mockAdapterHost)).toBe('express');
    });

    it('should return "unknown" when instance has neither Express nor Fastify methods', () => {
      const mockAdapterHost = {
        httpAdapter: {
          getInstance: () => ({
            someOtherMethod: vi.fn(),
          }),
        },
      };
      expect(detectAdapterType(mockAdapterHost)).toBe('unknown');
    });

    it('should prioritize Fastify detection over Express', () => {
      // If both register and use/get exist, it's Fastify (Fastify also has use/get)
      const mockAdapterHost = {
        httpAdapter: {
          getInstance: () => ({
            register: vi.fn(),
            use: vi.fn(),
            get: vi.fn(),
          }),
        },
      };
      expect(detectAdapterType(mockAdapterHost)).toBe('fastify');
    });
  });

  describe('getRawResponse', () => {
    it('should return the raw response for Fastify-like response', () => {
      const rawResponse = {
        statusCode: 200,
        headersSent: false,
        writableEnded: false,
        write: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn(),
      };
      const mockFastifyResponse = {
        sent: false,
        raw: rawResponse,
      };

      const result = getRawResponse(mockFastifyResponse as any);
      expect(result).toBe(rawResponse);
    });

    it('should return the response itself for Express-like response', () => {
      const mockExpressResponse = {
        statusCode: 200,
        headersSent: false,
        write: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn(),
      };

      const result = getRawResponse(mockExpressResponse as any);
      expect(result).toBe(mockExpressResponse);
    });

    it('should handle response with raw property but no write method', () => {
      // This is not a valid Fastify response, so should treat as Express
      const mockResponse = {
        statusCode: 200,
        raw: { noWriteMethod: true },
        write: vi.fn(),
      };

      const result = getRawResponse(mockResponse as any);
      expect(result).toBe(mockResponse);
    });
  });

  describe('isHeadersSent', () => {
    it('should return true when Fastify sent property is true', () => {
      const mockFastifyResponse = { sent: true };
      expect(isHeadersSent(mockFastifyResponse)).toBe(true);
    });

    it('should return false when Fastify sent property is false', () => {
      const mockFastifyResponse = { sent: false };
      expect(isHeadersSent(mockFastifyResponse)).toBe(false);
    });

    it('should return true when Express headersSent is true', () => {
      const mockExpressResponse = { headersSent: true };
      expect(isHeadersSent(mockExpressResponse)).toBe(true);
    });

    it('should return false when Express headersSent is false', () => {
      const mockExpressResponse = { headersSent: false };
      expect(isHeadersSent(mockExpressResponse)).toBe(false);
    });

    it('should return false when neither sent nor headersSent is set', () => {
      const mockResponse = {};
      expect(isHeadersSent(mockResponse)).toBe(false);
    });

    it('should prioritize Fastify sent over Express headersSent', () => {
      // If both exist, sent takes priority (Fastify behavior)
      const mockResponse = { sent: true, headersSent: false };
      expect(isHeadersSent(mockResponse)).toBe(true);
    });
  });
});

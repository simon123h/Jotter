import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isServerOnline, checkServerStatus, getProjects } from '@/api';

describe('api.ts - Connection Status Detection and Fetch Wrapper', () => {
  let fetchMock: any;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset connection status before each test
    isServerOnline.value = true;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('checkServerStatus()', () => {
    it('sets isServerOnline to true if server responds with a 200 status', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const result = await checkServerStatus();
      expect(result).toBe(true);
      expect(isServerOnline.value).toBe(true);
    });

    it('sets isServerOnline to true if server responds with a 500 status (server is running)', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Error' }),
      });

      const result = await checkServerStatus();
      expect(result).toBe(true);
      expect(isServerOnline.value).toBe(true);
    });

    it('sets isServerOnline to false if server responds with a 502 Bad Gateway status', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({}),
      });

      const result = await checkServerStatus();
      expect(result).toBe(false);
      expect(isServerOnline.value).toBe(false);
    });

    it('sets isServerOnline to false if fetch rejects (network error)', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await checkServerStatus();
      expect(result).toBe(false);
      expect(isServerOnline.value).toBe(false);
    });
  });

  describe('customFetch Wrapper', () => {
    it('sets isServerOnline to true on normal api request response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      // Start with server offline to verify it sets it to true
      isServerOnline.value = false;

      const projects = await getProjects();
      expect(projects).toEqual([]);
      expect(isServerOnline.value).toBe(true);
    });

    it('sets isServerOnline to false and throws on api network failure', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      // Start with server online to verify it sets it to false
      isServerOnline.value = true;

      await expect(getProjects()).rejects.toThrow();
      expect(isServerOnline.value).toBe(false);
    });

    it('sets isServerOnline to false when api response status is 503', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({}),
      });

      isServerOnline.value = true;

      await expect(getProjects()).rejects.toThrow();
      expect(isServerOnline.value).toBe(false);
    });
  });
});

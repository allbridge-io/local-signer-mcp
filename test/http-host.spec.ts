import { describe, expect, test } from '@jest/globals';

import { hostnameOf, isLoopbackHost } from '../src/http-server.js';

describe('HTTP Host check', () => {
  test('reads the host name from a Host header', () => {
    expect(hostnameOf('127.0.0.1:3333')).toBe('127.0.0.1');
    expect(hostnameOf('localhost')).toBe('localhost');
    expect(hostnameOf('[::1]:3333')).toBe('::1');
    expect(hostnameOf(undefined)).toBeUndefined();
  });

  test('accepts loopback names only', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('LOCALHOST')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('attacker.example')).toBe(false);
    expect(isLoopbackHost(hostnameOf('attacker.example:3333'))).toBe(false);
    expect(isLoopbackHost(undefined)).toBe(false);
  });
});

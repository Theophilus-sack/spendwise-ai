import { describe, test, expect } from 'bun:test';
import { isNetworkError, mergeSyncedRows } from './sync';

describe('isNetworkError', () => {
  test('recognizes a thrown fetch-layer TypeError', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
  });

  test('recognizes common network-failure message variants', () => {
    expect(isNetworkError({ message: 'Failed to fetch' })).toBe(true);
    expect(isNetworkError({ message: 'The operation timed out' })).toBe(true);
    expect(isNetworkError({ message: 'No internet connection available' })).toBe(true);
    expect(isNetworkError('network error occurred')).toBe(true);
  });

  test('does NOT treat a real Postgres/RLS rejection as a network error', () => {
    expect(isNetworkError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isNetworkError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(false);
    expect(isNetworkError(new Error('amount must be greater than 0'))).toBe(false);
  });

  test('handles null/undefined safely', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe('mergeSyncedRows', () => {
  interface Row { id: string; value: string }

  const remote: Row[] = [
    { id: 'a', value: 'remote-a' },
    { id: 'b', value: 'remote-b' },
    { id: 'c', value: 'remote-c' },
  ];
  const local: Row[] = [
    { id: 'a', value: 'local-a' },
    { id: 'b', value: 'local-b' },
    { id: 'c', value: 'local-c' },
    { id: 'd', value: 'local-d-not-yet-on-server' },
  ];

  test('with nothing pending, remote wins entirely (server is authoritative once synced)', () => {
    const result = mergeSyncedRows(remote, local, new Set(), new Set());
    expect(result).toEqual(remote);
  });

  test('a pending upsert keeps the LOCAL version instead of the just-fetched remote one', () => {
    const result = mergeSyncedRows(remote, local, new Set(['b']), new Set());
    const b = result.find(r => r.id === 'b');
    expect(b?.value).toBe('local-b');
    // Everything else still comes from remote.
    expect(result.find(r => r.id === 'a')?.value).toBe('remote-a');
  });

  test('a pending upsert for a row the server has never seen is still included from local', () => {
    const result = mergeSyncedRows(remote, local, new Set(['d']), new Set());
    expect(result.some(r => r.id === 'd' && r.value === 'local-d-not-yet-on-server')).toBe(true);
  });

  test('a pending delete excludes the row entirely, even though the server still returns it', () => {
    const result = mergeSyncedRows(remote, local, new Set(), new Set(['c']));
    expect(result.some(r => r.id === 'c')).toBe(false);
  });

  test('upsert and delete pending sets are handled together correctly', () => {
    const result = mergeSyncedRows(remote, local, new Set(['a']), new Set(['c']));
    expect(result.find(r => r.id === 'a')?.value).toBe('local-a'); // preserved local
    expect(result.some(r => r.id === 'c')).toBe(false);            // excluded
    expect(result.find(r => r.id === 'b')?.value).toBe('remote-b'); // untouched, remote wins
  });
});

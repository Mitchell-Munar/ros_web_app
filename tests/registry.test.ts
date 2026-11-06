import { afterEach, expect, test, vi } from 'vitest';
import { disposeSessions, getRobotSession, Mock } from '../src/core/robot';
afterEach(disposeSessions);
test('registry reuses a robot session and isolates robot IDs', () => {
 const factory = vi.fn(() => new Mock('mock'));
 const first = getRobotSession('a', factory);
 expect(getRobotSession('a', factory)).toBe(first);
 expect(getRobotSession('b', factory)).not.toBe(first);
 expect(factory).toHaveBeenCalledTimes(2);
});
test('unsubscribing does not stop the session', () => {
 const source = getRobotSession('a', () => new Mock('mock'));
 const listener = vi.fn();
 source.subscribe(listener)();
 expect(source.getSnapshot().status).toBe('connected');
 disposeSessions();
 expect(listener).not.toHaveBeenCalled();
 expect(source.getSnapshot().status).toBe('disconnected');
});

import { parse } from '@foxglove/rosmsg';
import { MessageReader, MessageWriter } from '@foxglove/rosmsg2-serialization';
import { test, expect } from 'vitest';
import assert from 'node:assert/strict';
import { Mock } from '../src/core/robot';
import { pingResponse } from '../src/types';
const source = new Mock('mock');
test('mock advertises ping and returns a validated response', async () => {
 source.start(); source.start();
 assert.equal(source.getSnapshot().services[0].name, '/web_ping');
 assert.deepEqual(pingResponse(await source.callService('/web_ping', {})), { success: true, message: 'Mock pong' });
 source.stop();
});
test('response guard rejects malformed decoded data', () => {
 for (const value of [null, {}, { success: 'true', message: 'pong' }]) assert.throws(() => pingResponse(value));
});
test('advertised empty request and Trigger response round trip through CDR', () => {
 const requestDefinitions = parse('', { ros2: true });
 const request = new MessageWriter(requestDefinitions).writeMessage({});
 assert.deepEqual(new MessageReader(requestDefinitions).readMessage(request), {});
 const definitions = parse('bool success\nstring message', { ros2: true });
 const expected = { success: true, message: 'pong' };
 assert.deepEqual(pingResponse(new MessageReader(definitions).readMessage(new MessageWriter(definitions).writeMessage(expected))), expected);
});

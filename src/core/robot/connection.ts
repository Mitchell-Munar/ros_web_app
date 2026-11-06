import { FoxgloveClient, type Channel, type Service, type ServerInfo } from '@foxglove/ws-protocol';
import { parse } from '@foxglove/rosmsg';
import { MessageReader, MessageWriter } from '@foxglove/rosmsg2-serialization';
export interface Snapshot { status: string; url: string; serverInfo?: ServerInfo; channels: Channel[]; services: Service[]; error?: string }
export interface TelemetrySource { start(): void; stop(): void; subscribe(listener: () => void): () => void; getSnapshot(): Snapshot; subscribeTopic(topic: string, listener: (value: unknown) => void, error: (message: string) => void): () => void; callService(name: string, request: Record<string, unknown>): Promise<unknown> }
import { createStore } from 'zustand/vanilla';
import { pingResponse } from '../../types';
type Pending = { serviceId: number; finish(value?: unknown, error?: Error): void; reader: MessageReader };
export class Connection implements TelemetrySource {
  constructor(private readonly url: string) {}
  private store = createStore<Snapshot>(() => ({ status: 'disconnected', url: this.url, channels: [], services: [] }));
  protected get snapshot() { return this.store.getState(); }
  private topics = new Map<string, Set<{ listener(value: unknown): void; error(message: string): void }>>();
  private readers = new Map<number, { topic: string; reader: MessageReader }>();
  subscribeTopic(topic: string, listener: (value: unknown) => void, error: (message: string) => void) {
    const entry = { listener, error };
    const entries = this.topics.get(topic) ?? new Set(); this.topics.set(topic, entries); entries.add(entry); this.syncTopics();
    return () => { entries.delete(entry); if (!entries.size) { this.topics.delete(topic); for (const [id, item] of this.readers) if (item.topic === topic) { this.client?.unsubscribe(id); this.readers.delete(id); } } };
  }
  private syncTopics() {
    if (!this.client || this.snapshot.status !== 'connected') return;
    for (const [topic, entries] of this.topics) {
      if ([...this.readers.values()].some(item => item.topic === topic)) continue;
      const channel = this.snapshot.channels.find(c => c.topic === topic); if (!channel) continue;
      try {
        if (channel.encoding !== 'cdr' || channel.schemaEncoding !== 'ros2msg' || typeof channel.schema !== 'string') throw new Error('Unsupported or absent topic schema');
        const reader = new MessageReader(parse(channel.schema, { ros2: true }));
        this.readers.set(this.client.subscribe(channel.id), { topic, reader });
      } catch (e) { entries.forEach(entry => entry.error(String(e))); }
    }
  }
  private client?: FoxgloveClient;
  private active = false;
  private timer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { return this.store.subscribe(listener); };
  protected update(patch: Partial<Snapshot>) { this.store.setState(patch); }
  start() { if (this.active) return; this.active = true; this.connect(); }
  stop() { this.active = false; clearTimeout(this.timer); const client = this.client; this.client = undefined; client?.close(); this.clear(); }
  private clear() { this.readers.clear(); this.topics.forEach(entries => entries.forEach(e => e.error('Disconnected'))); for (const p of this.pending.values()) p.finish(undefined, new Error('Connection closed')); this.update({ status: 'disconnected', serverInfo: undefined, channels: [], services: [] }); }
  private connect() {
    if (!this.active) return;
    this.update({ status: 'connecting', error: undefined });
    const client = new FoxgloveClient({ ws: new WebSocket(this.url, 'foxglove.sdk.v1') }); this.client = client;
    client.on('open', () => { this.update({ status: 'connected' }); });
    client.on('error', error => this.update({ error: error.message }));
    client.on('close', () => { if (this.client !== client) return; this.clear(); if (this.active) this.timer = setTimeout(() => this.connect(), Math.min(30000, 500 * 2 ** Math.min(this.attempt++, 6)) * (0.8 + Math.random() * 0.4)); });
    client.on('serverInfo', serverInfo => { console.log('Raw serverInfo', serverInfo); this.attempt = 0; this.update({ serverInfo }); });
    client.on('advertise', channels => { this.update({ channels: [...this.snapshot.channels.filter(c => !channels.some(n => n.id === c.id)), ...channels] }); this.syncTopics(); });
    client.on('message', event => { const item = this.readers.get(event.subscriptionId); if (!item) return; try { const value: unknown = item.reader.readMessage(event.data); this.topics.get(item.topic)?.forEach(e => e.listener(value)); } catch (error) { this.topics.get(item.topic)?.forEach(e => e.error(String(error))); } });
    client.on('unadvertise', ids => this.update({ channels: this.snapshot.channels.filter(c => !ids.includes(c.id)) }));
    client.on('advertiseServices', services => { console.log('Raw service advertisements', services); this.update({ services: [...this.snapshot.services.filter(s => !services.some(n => n.id === s.id)), ...services] }); });
    client.on('unadvertiseServices', ids => { for (const p of this.pending.values()) if (ids.includes(p.serviceId)) p.finish(undefined, new Error('Service removed')); this.update({ services: this.snapshot.services.filter(s => !ids.includes(s.id)) }); });
    client.on('serviceCallFailure', r => this.pending.get(r.callId)?.finish(undefined, new Error(r.message)));
    client.on('serviceCallResponse', r => { const p = this.pending.get(r.callId); if (!p || p.serviceId !== r.serviceId) return; try { if (r.encoding !== 'cdr') throw new Error('Unsupported response encoding'); const decoded: unknown = p.reader.readMessage(r.data); p.finish(this.snapshot.services.find(s => s.id === r.serviceId)?.name === '/web_ping' ? pingResponse(decoded) : decoded); } catch (e) { p.finish(undefined, e instanceof Error ? e : new Error(String(e))); } });
  }
  async callService(name: string, request: Record<string, unknown>): Promise<unknown> {
    if (this.snapshot.status !== 'connected' || !this.snapshot.serverInfo?.capabilities.includes('services')) throw new Error('Bridge service capability unavailable');
    const service = this.snapshot.services.find(s => s.name === name);
    if (!service) throw new Error(`${name} is not advertised`);
    const raw = service as unknown as Record<string, unknown>;
    const schema = (side: 'request' | 'response'): string => {
      const descriptor = raw[side];
      if (typeof descriptor === 'object' && descriptor !== null) {
        const d = descriptor as Record<string, unknown>;
        if (d.encoding !== 'cdr' || d.schemaEncoding !== 'ros2msg' || typeof d.schema !== 'string') throw new Error(`Unsupported ${side} schema/encoding`);
        return d.schema;
      }
      const legacy = raw[`${side}Schema`];
      if (typeof legacy !== 'string') throw new Error(`Bridge did not advertise ${side} schema; cannot call safely`);
      if (!this.snapshot.serverInfo?.supportedEncodings?.includes('cdr')) throw new Error('Bridge does not advertise CDR support');
      return legacy;
    };
    const definitions = parse(schema('request'), { ros2: true });
    if (name === '/web_ping' && definitions[0]?.definitions.some(f => !f.isConstant)) throw new Error('Ping request requires fields; incompatible with empty request');
    const data = new MessageWriter(definitions).writeMessage(request);
    const reader = new MessageReader(parse(schema('response'), { ros2: true }));
    const callId = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(undefined, new Error('Service timed out after 10 seconds')), 10000);
      const finish = (value?: unknown, error?: Error) => { clearTimeout(timer); this.pending.delete(callId); if (error) reject(error); else resolve(value); };
      this.pending.set(callId, { serviceId: service.id, reader, finish });
      try { this.client!.sendServiceCallRequest({ serviceId: service.id, callId, encoding: 'cdr', data }); } catch (e) { finish(undefined, new Error(String(e))); }
    });
  }
}
export class Mock extends Connection {
  override subscribeTopic(_topic: string, listener: (value: unknown) => void) {
    if (_topic === '/tf' || _topic === '/tf_static') {
      const emit = () => { const a = performance.now()/3000; listener({ transforms: [{header:{frame_id:'map'},child_frame_id:'odom',transform:{translation:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0,w:1}}}, {header:{frame_id:'odom'},child_frame_id:'base_link',transform:{translation:{x:2+Math.cos(a),y:2+Math.sin(a),z:0},rotation:{x:0,y:0,z:Math.sin((a+Math.PI/2)/2),w:Math.cos((a+Math.PI/2)/2)}}}] }); };
      const first=setTimeout(emit,0); const interval=setInterval(emit,50); return ()=>{clearTimeout(first);clearInterval(interval);};
    }
    const timer = setTimeout(() => listener({ header: {frame_id:'map'}, info: { width: 100, height: 80, resolution: 0.05, origin: { position: { x: 0, y: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }, data: Array.from({ length: 8000 }, (_, i) => i % 100 < 10 ? -1 : i % 100 === 50 || Math.floor(i / 100) === 40 ? 100 : 0) }), 0);
    return () => clearTimeout(timer);
  }
  override start() { this.update({ status: 'connected', url: 'mock (no socket)', serverInfo: { op: 'serverInfo', name: 'Mock bridge', capabilities: ['services'], supportedEncodings: ['cdr'] }, services: [{ id: 1, name: '/web_ping', type: 'std_srvs/srv/Trigger', requestSchema: '', responseSchema: 'bool success\nstring message' }] }); }
  override stop() { this.update({ status: 'disconnected' }); }
  override async callService(name: string) { if (name !== '/web_ping') throw new Error('Unknown service'); await new Promise(resolve => setTimeout(resolve, 200)); return { success: true, message: 'Mock pong' }; }
}

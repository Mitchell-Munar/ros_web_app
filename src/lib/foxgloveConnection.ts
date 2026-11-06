import { FoxgloveClient, type Channel, type Service, type ServerInfo } from '@foxglove/ws-protocol';
import { parse } from '@foxglove/rosmsg';
import { MessageReader, MessageWriter } from '@foxglove/rosmsg2-serialization';
export interface Snapshot { status: string; url: string; serverInfo?: ServerInfo; channels: Channel[]; services: Service[]; error?: string }
export interface TelemetrySource { start(): void; stop(): void; subscribe(listener: () => void): () => void; getSnapshot(): Snapshot; callService(name: string, request: Record<string, unknown>): Promise<unknown> }
const url = import.meta.env.VITE_FOXGLOVE_URL || 'ws://localhost:8765';
type Pending = { serviceId: number; finish(value?: unknown, error?: Error): void; reader: MessageReader };
class Connection implements TelemetrySource {
  protected snapshot: Snapshot = { status: 'disconnected', url, channels: [], services: [] };
  private listeners = new Set<() => void>();
  private client?: FoxgloveClient;
  private active = false;
  private timer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  protected update(patch: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(fn => fn()); }
  start() { if (this.active) return; this.active = true; this.connect(); }
  stop() { this.active = false; clearTimeout(this.timer); this.client?.close(); this.client = undefined; this.clear(); }
  private clear() { for (const p of this.pending.values()) p.finish(undefined, new Error('Connection closed')); this.update({ status: 'disconnected', serverInfo: undefined, channels: [], services: [] }); }
  private connect() {
    if (!this.active) return;
    this.update({ status: 'connecting', error: undefined });
    const client = new FoxgloveClient({ ws: new WebSocket(url, 'foxglove.sdk.v1') }); this.client = client;
    client.on('open', () => { this.update({ status: 'connected' }); });
    client.on('error', error => this.update({ error: error.message }));
    client.on('close', () => { this.clear(); if (this.active) this.timer = setTimeout(() => this.connect(), Math.min(30000, 500 * 2 ** Math.min(this.attempt++, 6)) * (0.8 + Math.random() * 0.4)); });
    client.on('serverInfo', serverInfo => { console.log('Raw serverInfo', serverInfo); this.attempt = 0; this.update({ serverInfo }); });
    client.on('advertise', channels => this.update({ channels: [...this.snapshot.channels.filter(c => !channels.some(n => n.id === c.id)), ...channels] }));
    client.on('unadvertise', ids => this.update({ channels: this.snapshot.channels.filter(c => !ids.includes(c.id)) }));
    client.on('advertiseServices', services => { console.log('Raw service advertisements', services); this.update({ services: [...this.snapshot.services.filter(s => !services.some(n => n.id === s.id)), ...services] }); });
    client.on('unadvertiseServices', ids => { for (const p of this.pending.values()) if (ids.includes(p.serviceId)) p.finish(undefined, new Error('Service removed')); this.update({ services: this.snapshot.services.filter(s => !ids.includes(s.id)) }); });
    client.on('serviceCallFailure', r => this.pending.get(r.callId)?.finish(undefined, new Error(r.message)));
    client.on('serviceCallResponse', r => { const p = this.pending.get(r.callId); if (!p || p.serviceId !== r.serviceId) return; try { if (r.encoding !== 'cdr') throw new Error('Unsupported response encoding'); p.finish(p.reader.readMessage(r.data)); } catch (e) { p.finish(undefined, e instanceof Error ? e : new Error(String(e))); } });
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
class Mock extends Connection {
  override start() { this.update({ status: 'connected', url: 'mock (no socket)', serverInfo: { op: 'serverInfo', name: 'Mock bridge', capabilities: ['services'], supportedEncodings: ['cdr'] }, services: [{ id: 1, name: '/web_ping', type: 'std_srvs/srv/Trigger', requestSchema: '', responseSchema: 'bool success\nstring message' }] }); }
  override stop() { this.update({ status: 'disconnected' }); }
  override async callService(name: string) { if (name !== '/web_ping') throw new Error('Unknown service'); await new Promise(resolve => setTimeout(resolve, 200)); return { success: true, message: 'Mock pong' }; }
}
export const telemetrySource: TelemetrySource = import.meta.env.VITE_USE_MOCK === 'true' ? new Mock() : new Connection();
if (import.meta.hot) import.meta.hot.dispose(() => telemetrySource.stop());

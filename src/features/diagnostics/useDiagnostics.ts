import { useState, useSyncExternalStore } from 'react';
import type { TelemetrySource } from '../../core/robot';
export function useDiagnostics(source: TelemetrySource) {
 const s = useSyncExternalStore(source.subscribe, source.getSnapshot);
 const [busy, setBusy] = useState(false), [result, setResult] = useState('');
 const reason = s.status !== 'connected' ? 'Connect to the bridge first' : !s.serverInfo?.capabilities.includes('services') ? 'Bridge service capability unavailable' : !s.services.some(x => x.name === '/web_ping') ? '/web_ping is not advertised' : '';
 async function call() { setBusy(true); const start = performance.now(); try { setResult(JSON.stringify((await source.callService('/web_ping', {})), null, 2)); } catch(e) { setResult(String(e)); } finally { setResult(value => `${value}\nLatency: ${(performance.now() - start).toFixed(1)} ms`); setBusy(false); } }
 return { s, busy, result, reason, call };
}

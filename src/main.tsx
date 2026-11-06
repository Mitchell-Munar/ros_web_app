import { StrictMode, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { telemetrySource as source } from './lib/foxgloveConnection';
import { pingResponse } from './types/ros';
import './style.css';
source.start();
function App() {
 const s = useSyncExternalStore(source.subscribe, source.getSnapshot);
 const [busy, setBusy] = useState(false), [result, setResult] = useState('');
 const reason = s.status !== 'connected' ? 'Connect to the bridge first' : !s.serverInfo?.capabilities.includes('services') ? 'Bridge service capability unavailable' : !s.services.some(x => x.name === '/web_ping') ? '/web_ping is not advertised' : '';
 async function call() { setBusy(true); const start = performance.now(); try { setResult(JSON.stringify(pingResponse(await source.callService('/web_ping', {})), null, 2)); } catch(e) { setResult(String(e)); } finally { setResult(value => `${value}\nLatency: ${(performance.now() - start).toFixed(1)} ms`); setBusy(false); } }
 return <main><h1>ROS bridge</h1><p><strong className="badge">{s.status}</strong> {s.url}</p>{s.error && <p role="alert">{s.error}</p>}<h2>Capabilities</h2><p>{s.serverInfo?.capabilities.join(', ') || 'None advertised'}</p><h2>Channels</h2><table><thead><tr><th>ID</th><th>Topic</th><th>Schema</th><th>Encoding</th></tr></thead><tbody>{s.channels.map(c => <tr key={c.id}><td>{c.id}</td><td>{c.topic}</td><td>{c.schemaName}</td><td>{c.encoding}</td></tr>)}</tbody></table><h2>Services</h2><table><thead><tr><th>ID</th><th>Name</th><th>Type</th></tr></thead><tbody>{s.services.map(x => <tr key={x.id}><td>{x.id}</td><td>{x.name}</td><td>{x.type}</td></tr>)}</tbody></table><p>{reason}</p><button disabled={busy || !!reason} onClick={call}>{busy ? 'Calling…' : 'Call /web_ping'}</button><pre aria-live="polite">{result}</pre></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

import type { TelemetrySource } from './connection';
const sessions = new Map<string, TelemetrySource>();
export function getRobotSession(id: string, create: () => TelemetrySource): TelemetrySource { let session = sessions.get(id); if (!session) { session = create(); sessions.set(id, session); session.start(); } return session; }
export function disposeSessions() { sessions.forEach(session => session.stop()); sessions.clear(); }

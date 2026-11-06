export interface PingResponse { success: boolean; message: string }
export function pingResponse(value: unknown): PingResponse {
  if (typeof value !== 'object' || value === null || !('success' in value) || typeof value.success !== 'boolean' || !('message' in value) || typeof value.message !== 'string') throw new Error('Incompatible ping response: expected success and message');
  return { success: value.success, message: value.message };
}

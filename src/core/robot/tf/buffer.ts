export interface Pose { x: number; y: number; theta: number }
type Edge = { parent: string; pose: Pose; received: number; fixed: boolean };
const frame = (name: string) => name.replace(/^\/+/, '');
export class TransformBuffer {
 private edges = new Map<string, Edge>();
 clear() { this.edges.clear(); }
 update(value: unknown, fixed = false, now = performance.now()) {
  if (!value || typeof value !== 'object' || !('transforms' in value) || !Array.isArray(value.transforms)) throw Error('Invalid TFMessage');
  for (const raw of value.transforms) {
   const t = raw as { header?: { frame_id?: unknown }; child_frame_id?: unknown; transform?: { translation?: Record<string, unknown>; rotation?: Record<string, unknown> } };
   const p=t.transform?.translation, q=t.transform?.rotation;
   if (typeof t.header?.frame_id !== 'string' || typeof t.child_frame_id !== 'string' || !p || !q || !['x','y','z'].every(k=>typeof p[k]==='number' && Number.isFinite(p[k])) || !['x','y','z','w'].every(k=>typeof q[k]==='number' && Number.isFinite(q[k]))) throw Error('Invalid transform');
   const x=Number(q.x), y=Number(q.y), z=Number(q.z), w=Number(q.w), norm=x*x+y*y+z*z+w*w;
   if(norm<1e-12) throw Error('Invalid quaternion');
   this.edges.set(frame(t.child_frame_id), {parent:frame(t.header.frame_id),pose:{x:Number(p.x),y:Number(p.y),theta:Math.atan2(2*(w*z+x*y)/norm,1-2*(y*y+z*z)/norm)},received:now,fixed});
  }
 }
 lookup(parent: string, child: string, now=performance.now()): Pose | undefined {
  let current=frame(child); const target=frame(parent); let pose:Pose={x:0,y:0,theta:0}; const seen=new Set<string>();
  while(current!==target) {
   if(seen.has(current)) return; seen.add(current);
   const edge=this.edges.get(current); if(!edge || (!edge.fixed && now-edge.received>2000)) return;
   const c=Math.cos(edge.pose.theta), s=Math.sin(edge.pose.theta);
   pose={x:edge.pose.x+c*pose.x-s*pose.y,y:edge.pose.y+s*pose.x+c*pose.y,theta:edge.pose.theta+pose.theta}; current=edge.parent;
  }
  return pose;
 }
}

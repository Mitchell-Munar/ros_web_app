import { expect, test } from 'vitest';
import { TransformBuffer } from '../src/core/robot';
const message = (parent: string, child: string, x: number, angle=0) => ({transforms:[{header:{frame_id:parent},child_frame_id:child,transform:{translation:{x,y:0,z:0},rotation:{x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)}}}]});
test('composes translation and heading through static and dynamic edges',()=>{
 const buffer=new TransformBuffer();buffer.update(message('map','odom',1,Math.PI/2),true,0);buffer.update(message('odom','base_link',2),false,0);
 const pose=buffer.lookup('map','base_link',100)!;expect(pose.x).toBeCloseTo(1);expect(pose.y).toBeCloseTo(2);expect(pose.theta).toBeCloseTo(Math.PI/2);
 expect(buffer.lookup('map','base_link',2100)).toBeUndefined();expect(buffer.lookup('map','odom',10000)).toBeDefined();
});
test('missing frames, cycles, invalid messages and reset are safe',()=>{
 const buffer=new TransformBuffer();expect(buffer.lookup('map','base_link')).toBeUndefined();expect(()=>buffer.update({})).toThrow();buffer.update(message('a','b',0),true);buffer.update(message('b','a',0),true);expect(buffer.lookup('map','a')).toBeUndefined();buffer.clear();expect(buffer.lookup('a','b')).toBeUndefined();
});

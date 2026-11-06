import { useEffect, useRef, useState } from 'react';
import { TransformBuffer, type TelemetrySource } from '../../core/robot';
export function MapView({ source }: { source: TelemetrySource }) {
 const ref = useRef<HTMLCanvasElement>(null);
 const [error, setError] = useState('Waiting for /map');
 useEffect(() => {
  const canvas = ref.current!; const ctx = canvas.getContext('2d')!;
  let bitmap: HTMLCanvasElement | undefined; let scale = 1, x = 0, y = 0;
  const tf = new TransformBuffer();
  let resolution=0.05, originX=0, originY=0, originYaw=0, mapFrame='map';
  const offTf = source.subscribeTopic('/tf', v=>tf.update(v), ()=>tf.clear());
  const offStatic = source.subscribeTopic('/tf_static', v=>tf.update(v,true), ()=>tf.clear());
  const draw = () => { ctx.fillStyle = '#253545'; ctx.fillRect(0,0,canvas.width,canvas.height); if(bitmap) { ctx.imageSmoothingEnabled = false; ctx.drawImage(bitmap,x,y,bitmap.width*scale,bitmap.height*scale);
    const pose=tf.lookup(mapFrame,'base_link') ?? tf.lookup(mapFrame,'base_footprint');
    if(pose) {
      const dx=pose.x-originX, dy=pose.y-originY, c=Math.cos(originYaw), s=Math.sin(originYaw);
      const px=x+(c*dx+s*dy)/resolution*scale, py=y+(bitmap.height-(-s*dx+c*dy)/resolution)*scale;
      ctx.save();ctx.translate(px,py);ctx.rotate(-(pose.theta-originYaw));ctx.strokeStyle='#00dcff';ctx.fillStyle='#008ca8';ctx.lineWidth=2*devicePixelRatio;
      const radius=Math.max(7*devicePixelRatio,.18/resolution*scale);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(radius*2,0);ctx.lineTo(radius*1.5,-radius*.4);ctx.moveTo(radius*2,0);ctx.lineTo(radius*1.5,radius*.4);ctx.stroke();ctx.restore();
    } else {ctx.fillStyle='white';ctx.font='16px system-ui';ctx.fillText('Waiting for robot transforms',12,24);}
  } };
  const resize = () => { canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio; draw(); };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const off = source.subscribeTopic('/map', value => {
   try {
    const v = value as { header?: { frame_id: string }; info: { width: number; height: number; resolution: number; origin: {position: {x:number;y:number};orientation:{z:number;w:number}} }; data: ArrayLike<number> }; const { width, height } = v.info;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || v.data.length !== width*height) throw Error('Invalid map dimensions');
    resolution=v.info.resolution; if(!Number.isFinite(resolution)||resolution<=0) throw Error('Invalid map resolution'); originX=v.info.origin.position.x;originY=v.info.origin.position.y;originYaw=2*Math.atan2(v.info.origin.orientation.z,v.info.origin.orientation.w);mapFrame=v.header?.frame_id || 'map';
    bitmap = document.createElement('canvas'); bitmap.width = width; bitmap.height = height;
    const b = bitmap.getContext('2d')!; const image = b.createImageData(width,height);
    for(let i=0;i<v.data.length;i++) { const n=v.data[i]!; if(n < -1 || n > 100) throw Error('Invalid occupancy'); const color=n===-1?128:Math.round(255*(1-n/100)); const j=((height-1-Math.floor(i/width))*width+i%width)*4; image.data.set([color,color,color,255],j); }
    b.putImageData(image,0,0); scale=Math.min(canvas.width/width,canvas.height/height); x=0;y=0;setError('');draw();
   } catch(e) { bitmap=undefined;setError(String(e));draw(); }
  }, message => {bitmap=undefined;setError(message);draw();});
  const wheel = (e: WheelEvent) => {e.preventDefault(); const r=canvas.getBoundingClientRect(); const px=(e.clientX-r.left)*devicePixelRatio, py=(e.clientY-r.top)*devicePixelRatio; const next=Math.max(.01,Math.min(100,scale*Math.exp(-e.deltaY*.001))); x=px-(px-x)*next/scale;y=py-(py-y)*next/scale;scale=next;draw();};
  const move=(e: PointerEvent)=>{if(e.buttons===1){x+=e.movementX*devicePixelRatio;y+=e.movementY*devicePixelRatio;draw();}};
  canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('pointermove',move);
  const interval=setInterval(draw,50);
  return ()=>{clearInterval(interval);offTf();offStatic();off();observer.disconnect();canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('pointermove',move);};
 },[source]);
 return <section><h1>Map</h1><p>{error || 'Drag to pan · Scroll to zoom'}</p><canvas ref={ref} style={{width:'100%',height:480,touchAction:'none'}} aria-label="Occupancy map" /></section>;
}

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OUTPUT = resolve('public/assets/models/arena/chen-center-pillar.glb');
const enc = new TextEncoder();

const materials = [
  { name: 'Stone', pbrMetallicRoughness: { baseColorFactor: [0.305,0.302,0.286,1], metallicFactor: 0.02, roughnessFactor: 0.93 } },
  { name: 'DarkStone', pbrMetallicRoughness: { baseColorFactor: [0.173,0.173,0.184,1], metallicFactor: 0.01, roughnessFactor: 0.98 } },
  { name: 'StoneHighlight', pbrMetallicRoughness: { baseColorFactor: [0.376,0.369,0.345,1], metallicFactor: 0.01, roughnessFactor: 0.88 } },
  { name: 'SerpentRed', pbrMetallicRoughness: { baseColorFactor: [0.463,0.137,0.227,1], metallicFactor: 0.03, roughnessFactor: 0.53 } },
  { name: 'SerpentShadow', pbrMetallicRoughness: { baseColorFactor: [0.247,0.078,0.145,1], metallicFactor: 0.02, roughnessFactor: 0.66 } },
  { name: 'Bronze', pbrMetallicRoughness: { baseColorFactor: [0.631,0.467,0.188,1], metallicFactor: 0.45, roughnessFactor: 0.38 } },
  { name: 'EyeGold', pbrMetallicRoughness: { baseColorFactor: [0.973,0.824,0.361,1], metallicFactor: 0.05, roughnessFactor: 0.2 }, emissiveFactor: [0.25,0.16,0.025] }
];

const chunks = [];
const bufferViews = [];
const accessors = [];
const meshes = [];
const nodes = [];
let byteLength = 0;

const pad4 = n => (n + 3) & ~3;
function pushBuffer(typed, target) {
  const src = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  const padded = new Uint8Array(pad4(src.byteLength));
  padded.set(src);
  const offset = byteLength;
  chunks.push(padded);
  byteLength += padded.byteLength;
  const index = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: src.byteLength, target });
  return index;
}
function minMax3(values) {
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<values.length;i+=3) for(let a=0;a<3;a++){ min[a]=Math.min(min[a],values[i+a]); max[a]=Math.max(max[a],values[i+a]); }
  return {min,max};
}
function addAccessor(typed, type, componentType, target, min, max) {
  const view = pushBuffer(typed, target);
  const count = typed.length / (type === 'VEC3' ? 3 : 1);
  const accessor = { bufferView:view, componentType, count, type };
  if (min) accessor.min=min;
  if (max) accessor.max=max;
  accessors.push(accessor);
  return accessors.length-1;
}
function computeNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let i=0;i<idx.length;i+=3) {
    const ia=idx[i]*3, ib=idx[i+1]*3, ic=idx[i+2]*3;
    const ax=pos[ia], ay=pos[ia+1], az=pos[ia+2];
    const bx=pos[ib], by=pos[ib+1], bz=pos[ib+2];
    const cx=pos[ic], cy=pos[ic+1], cz=pos[ic+2];
    const abx=bx-ax, aby=by-ay, abz=bz-az, acx=cx-ax, acy=cy-ay, acz=cz-az;
    const nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
    for (const o of [ia,ib,ic]) { n[o]+=nx; n[o+1]+=ny; n[o+2]+=nz; }
  }
  for (let i=0;i<n.length;i+=3) {
    const l=Math.hypot(n[i],n[i+1],n[i+2])||1; n[i]/=l;n[i+1]/=l;n[i+2]/=l;
  }
  return n;
}
function addMesh(name, positions, indices, material) {
  const pos = new Float32Array(positions);
  const idx = Math.max(...indices) > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  const mm=minMax3(pos);
  const posAcc=addAccessor(pos,'VEC3',5126,34962,mm.min,mm.max);
  const normAcc=addAccessor(computeNormals(pos,idx),'VEC3',5126,34962);
  const idxAcc=addAccessor(idx,'SCALAR',idx instanceof Uint32Array?5125:5123,34963,[0],[Math.max(...indices)]);
  meshes.push({ name, primitives:[{attributes:{POSITION:posAcc,NORMAL:normAcc},indices:idxAcc,material}] });
  return meshes.length-1;
}
function boxGeometry() {
  const p=[-0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5, -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5];
  const i=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]; return [p,i];
}
function cylinderGeometry(segments=16) {
  const p=[],i=[];
  for(let y of [-0.5,0.5]) for(let s=0;s<segments;s++){ const a=2*Math.PI*s/segments;p.push(Math.cos(a),y,Math.sin(a)); }
  p.push(0,-0.5,0, 0,0.5,0); const b=segments*2,t=b+1;
  for(let s=0;s<segments;s++){ const n=(s+1)%segments; i.push(s,n,segments+n,s,segments+n,segments+s); i.push(b,n,s); i.push(t,segments+s,segments+n); }
  return [p,i];
}
function coneGeometry(segments=10) {
  const p=[],i=[]; for(let s=0;s<segments;s++){ const a=2*Math.PI*s/segments;p.push(Math.cos(a),-0.5,Math.sin(a)); } p.push(0,0.5,0,0,-0.5,0); const tip=segments,base=segments+1;
  for(let s=0;s<segments;s++){ const n=(s+1)%segments;i.push(s,n,tip,base,n,s); } return [p,i];
}
function sphereGeometry(lat=6,lon=10) {
  const p=[],i=[]; for(let y=0;y<=lat;y++){ const v=y/lat,phi=v*Math.PI; for(let x=0;x<=lon;x++){ const u=x/lon,th=u*Math.PI*2;p.push(Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th)); }}
  for(let y=0;y<lat;y++) for(let x=0;x<lon;x++){ const a=y*(lon+1)+x,b=a+lon+1;i.push(a,b,a+1,b,b+1,a+1); } return [p,i];
}
function torusGeometry(major=1,minor=.1,majSeg=24,minSeg=6) {
  const p=[],i=[]; for(let a=0;a<=majSeg;a++){ const u=a/majSeg*Math.PI*2; for(let b=0;b<=minSeg;b++){ const v=b/minSeg*Math.PI*2; const r=major+minor*Math.cos(v);p.push(r*Math.cos(u),minor*Math.sin(v),r*Math.sin(u)); }}
  for(let a=0;a<majSeg;a++) for(let b=0;b<minSeg;b++){ const x=a*(minSeg+1)+b,y=x+minSeg+1;i.push(x,y,x+1,y,y+1,x+1); } return [p,i];
}
const [bp,bi]=boxGeometry(), [cp,ci]=cylinderGeometry(), [sp,si]=sphereGeometry(), [kp,ki]=coneGeometry(), [tp,ti]=torusGeometry();
const meshBoxDark=addMesh('RibDark',bp,bi,1), meshBoxHi=addMesh('RibHighlight',bp,bi,2), meshCylinderStone=addMesh('StoneCylinder',cp,ci,0), meshCylinderDark=addMesh('DarkCylinder',cp,ci,1), meshCylinderBronze=addMesh('BronzeCylinder',cp,ci,5), meshSphereSerpent=addMesh('SerpentSphere',sp,si,3), meshSphereShadow=addMesh('SerpentShadowSphere',sp,si,4), meshSphereEye=addMesh('EyeSphere',sp,si,6), meshConeSerpent=addMesh('SerpentCone',kp,ki,3), meshConeDark=addMesh('DarkCone',kp,ki,1), meshTorusBronze=addMesh('BronzeRing',tp,ti,5), meshTorusDark=addMesh('DarkRing',tp,ti,1), meshTorusHi=addMesh('HighlightRing',tp,ti,2);

const qY = a => [0,Math.sin(a/2),0,Math.cos(a/2)];
function node(name,mesh,translation=[0,0,0],scale=[1,1,1],rotation) { const n={name,mesh,translation,scale}; if(rotation)n.rotation=rotation; nodes.push(n); return nodes.length-1; }
node('Plinth',meshCylinderDark,[0,.22,0],[2.06,.44,2.06]);
node('Base',meshCylinderStone,[0,.75,0],[1.72,.66,1.72]);
node('BaseCollar',meshTorusBronze,[0,1.03,0],[1.5/.999,1,1.5/.999]);
node('Shaft',meshCylinderStone,[0,5.95,0],[1.13,9.9,1.13]);
for(let r=0;r<12;r++){ const a=2*Math.PI*r/12;node(`Rib_${r}`,r%3===0?meshBoxHi:meshBoxDark,[Math.cos(a)*1.115,5.9,Math.sin(a)*1.115],[.12,9,.2],qY(-a)); }
for(let r=0;r<7;r++){ const mesh=r%3===1?meshTorusDark:meshTorusHi; node(`StoneBand_${r}`,mesh,[0,1.55+r*1.3,0],[1.12+(r%2)*.04,.6,1.12+(r%2)*.04]); }
node('CapLower',meshCylinderDark,[0,10.98,0],[1.32,.48,1.32]); node('CapUpper',meshCylinderStone,[0,11.43,0],[1.54,.44,1.54]); node('CapCrown',meshTorusBronze,[0,11.58,0],[1.34,1.05,1.34]); node('TopDisk',meshCylinderBronze,[0,11.78,0],[.92,.22,.92]);
for(let s=0;s<4;s++){ const a=2*Math.PI*s/4+Math.PI/4; node(`TopSpike_${s}`,meshConeDark,[Math.cos(a)*.75,12.03,Math.sin(a)*.75],[.16,.6,.16]); }
const turns=2.72;
for(let s=0;s<72;s++){ const t=s/71,a=-1+t*Math.PI*2*turns,r=1.31+.055*Math.sin(t*Math.PI*5),rad=.235-.025*t; node(`Serpent_${s}`,meshSphereSerpent,[Math.cos(a)*r,.82+t*9.65,Math.sin(a)*r],[rad,rad,rad]); }
for(let s=0;s<14;s++){ const t=s/13,a=-2.7+t*1.4,r=1.25+t*.7,rad=.25*(1-.6*t);node(`Tail_${s}`,meshSphereShadow,[Math.cos(a)*r,.7*(1-t)+.22,Math.sin(a)*r],[rad,rad,rad]); }
const ha=-1+Math.PI*2*turns,hp=[Math.cos(ha)*1.31,.82+9.65,Math.sin(ha)*1.31];
node('SerpentHead',meshSphereSerpent,[hp[0],hp[1]+.18,hp[2]],[.46,.32,.38]); node('SerpentSnout',meshConeSerpent,[hp[0]+Math.cos(ha)*.28,hp[1]+.1,hp[2]+Math.sin(ha)*.28],[.26,.6,.26],qY(-ha)); node('SerpentBrow',meshBoxDark,[hp[0],hp[1]+.42,hp[2]],[.72,.14,.32],qY(-ha));
for(const side of [-1,1]){ const tx=-Math.sin(ha)*side*.19, tz=Math.cos(ha)*side*.19; node(side<0?'EyeL':'EyeR',meshSphereEye,[hp[0]+tx+Math.cos(ha)*.14,hp[1]+.33,hp[2]+tz+Math.sin(ha)*.14],[.075,.075,.075]); }
for(let s=0;s<10;s++){ const a=2*Math.PI*s/10+.12;node(`BaseStud_${s}`,meshCylinderBronze,[Math.cos(a)*1.62,.64,Math.sin(a)*1.62],[.09,.09,.09]); }

const bin = new Uint8Array(byteLength); let cursor=0; for(const c of chunks){ bin.set(c,cursor);cursor+=c.byteLength; }
const gltf={asset:{version:'2.0',generator:'Ninjago Tournament clean-room asset generator'},scene:0,scenes:[{name:'ChenCenterPillar',nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,buffers:[{byteLength:bin.byteLength}],bufferViews,accessors};
let json=enc.encode(JSON.stringify(gltf)); const jsonPad=pad4(json.byteLength); const jsonChunk=new Uint8Array(jsonPad);jsonChunk.fill(0x20);jsonChunk.set(json);
const binPad=pad4(bin.byteLength); const binChunk=new Uint8Array(binPad);binChunk.set(bin);
const total=12+8+jsonChunk.byteLength+8+binChunk.byteLength; const out=new ArrayBuffer(total), view=new DataView(out); const bytes=new Uint8Array(out); let o=0;
view.setUint32(o,0x46546c67,true);o+=4;view.setUint32(o,2,true);o+=4;view.setUint32(o,total,true);o+=4;view.setUint32(o,jsonChunk.byteLength,true);o+=4;view.setUint32(o,0x4e4f534a,true);o+=4;bytes.set(jsonChunk,o);o+=jsonChunk.byteLength;view.setUint32(o,binChunk.byteLength,true);o+=4;view.setUint32(o,0x004e4942,true);o+=4;bytes.set(binChunk,o);
await mkdir(dirname(OUTPUT),{recursive:true});
await writeFile(OUTPUT,new Uint8Array(out));
console.log(`Generated ${OUTPUT} (${total} bytes)`);

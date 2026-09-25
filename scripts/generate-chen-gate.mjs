import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OUTPUT = resolve('public/assets/models/arena/chen-gate.glb');
const enc = new TextEncoder();
const materials = [
  { name:'Stone', pbrMetallicRoughness:{ baseColorFactor:[0.23,0.24,0.26,1], metallicFactor:0.02, roughnessFactor:0.94 } },
  { name:'DarkStone', pbrMetallicRoughness:{ baseColorFactor:[0.16,0.17,0.19,1], metallicFactor:0.01, roughnessFactor:0.98 } },
  { name:'DoorRed', pbrMetallicRoughness:{ baseColorFactor:[0.40,0.12,0.14,1], metallicFactor:0.07, roughnessFactor:0.69 } },
  { name:'Gold', pbrMetallicRoughness:{ baseColorFactor:[0.72,0.52,0.18,1], metallicFactor:0.55, roughnessFactor:0.34 } },
  { name:'SerpentAccent', pbrMetallicRoughness:{ baseColorFactor:[0.43,0.13,0.24,1], metallicFactor:0.04, roughnessFactor:0.56 } }
];
const chunks=[], bufferViews=[], accessors=[], meshes=[], nodes=[]; let byteLength=0;
const pad4=n=>(n+3)&~3;
function pushBuffer(typed,target){const src=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength),padded=new Uint8Array(pad4(src.byteLength));padded.set(src);const offset=byteLength;chunks.push(padded);byteLength+=padded.byteLength;bufferViews.push({buffer:0,byteOffset:offset,byteLength:src.byteLength,target});return bufferViews.length-1;}
function minMax3(v){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<v.length;i+=3)for(let a=0;a<3;a++){min[a]=Math.min(min[a],v[i+a]);max[a]=Math.max(max[a],v[i+a]);}return{min,max};}
function accessor(typed,type,componentType,target,min,max){const bufferView=pushBuffer(typed,target),count=typed.length/(type==='VEC3'?3:1),a={bufferView,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessors.length-1;}
function normals(pos,idx){const n=new Float32Array(pos.length);for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3,ab=[pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]],ac=[pos[c]-pos[a],pos[c+1]-pos[a+1],pos[c+2]-pos[a+2]],nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];for(const o of[a,b,c]){n[o]+=nn[0];n[o+1]+=nn[1];n[o+2]+=nn[2];}}for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}return n;}
function addMesh(name,p,i,material){const pos=new Float32Array(p),idx=new Uint16Array(i),mm=minMax3(pos);const pa=accessor(pos,'VEC3',5126,34962,mm.min,mm.max),na=accessor(normals(pos,idx),'VEC3',5126,34962),ia=accessor(idx,'SCALAR',5123,34963,[0],[Math.max(...i)]);meshes.push({name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material}]});return meshes.length-1;}
function box(){return[[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]];}
function cylinder(seg=16){const p=[],i=[];for(const y of[-.5,.5])for(let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),y,Math.sin(a));}p.push(0,-.5,0,0,.5,0);const b=seg*2,t=b+1;for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,seg+n,s,seg+n,seg+s,b,n,s,t,seg+s,seg+n);}return[p,i];}
function torus(maj=1,min=.1,ms=24,ns=6){const p=[],i=[];for(let a=0;a<=ms;a++){const u=a/ms*Math.PI*2;for(let b=0;b<=ns;b++){const v=b/ns*Math.PI*2,r=maj+min*Math.cos(v);p.push(r*Math.cos(u),min*Math.sin(v),r*Math.sin(u));}}for(let a=0;a<ms;a++)for(let b=0;b<ns;b++){const x=a*(ns+1)+b,y=x+ns+1;i.push(x,y,x+1,y,y+1,x+1);}return[p,i];}
function cone(seg=10){const p=[],i=[];for(let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),-.5,Math.sin(a));}p.push(0,.5,0,0,-.5,0);const tip=seg,base=seg+1;for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,tip,base,n,s);}return[p,i];}
const [bp,bi]=box(),[cp,ci]=cylinder(),[tp,ti]=torus(),[kp,ki]=cone();
const boxStone=addMesh('StoneBox',bp,bi,0),boxDark=addMesh('DarkBox',bp,bi,1),boxRed=addMesh('RedDoorBox',bp,bi,2),boxGold=addMesh('GoldBox',bp,bi,3),cylGold=addMesh('GoldCylinder',cp,ci,3),cylRed=addMesh('RedCylinder',cp,ci,2),torGold=addMesh('GoldTorus',tp,ti,3),coneDark=addMesh('DarkCone',kp,ki,1),coneSerp=addMesh('SerpentCone',kp,ki,4);
const qY=a=>[0,Math.sin(a/2),0,Math.cos(a/2)];
function node(name,mesh,t=[0,0,0],s=[1,1,1],r){const n={name,mesh,translation:t,scale:s};if(r)n.rotation=r;nodes.push(n);return nodes.length-1;}
for(const side of[-1,1]){
  node(side<0?'LeftTower':'RightTower',boxStone,[side*4.15,2.55,0],[2.45,5.5,2.25]);
  node(`TowerPlinth_${side}`,boxDark,[side*4.15,.32,.08],[2.85,.64,2.55]);
  node(`TowerCap_${side}`,boxDark,[side*4.15,5.38,0],[2.9,.42,2.58]);
  for(let r=0;r<3;r++) node(`TowerRib_${side}_${r}`,boxDark,[side*(3.32+r*.82),2.72,1.17],[.16,4.7,.18]);
  node(`TowerGoldBand_${side}`,boxGold,[side*4.15,4.45,1.18],[2.0,.12,.12]);
  node(`RoofHorn_${side}`,coneDark,[side*5.0,6.8,.15],[.34,1.25,.34],qY(side>0?-.28:.28));
}
node('Lintel',boxDark,[0,5.05,0],[10.7,1.25,2.45]);
node('Roof',boxStone,[0,5.92,0],[11.9,.42,3.25]);
node('RoofTop',boxDark,[0,6.25,-.08],[9.5,.22,2.4]);
for(const side of[-1,1]){
 node(side<0?'DoorLeft':'DoorRight',boxRed,[side*1.78,2.14,1.22],[3.48,4.32,.30]);
 for(let row=0;row<4;row++)for(let col=0;col<3;col++)node(`DoorStud_${side}_${row}_${col}`,cylGold,[side*(.72+col*.55),.75+row*.88,1.41],[.085,.09,.085]);
 node(`DoorBraceH_${side}`,boxDark,[side*1.78,2.13,1.39],[2.9,.13,.08]);
 node(`DoorBraceV_${side}`,boxDark,[side*1.78,2.13,1.39],[.13,3.7,.08]);
}
node('CrestRing',torGold,[0,5.08,1.34],[.82,.82,.82]);
node('CrestCore',cylRed,[0,5.08,1.34],[.45,.15,.45]);
node('SerpentReliefHead',coneSerp,[0,4.96,1.55],[.42,.92,.42],qY(Math.PI));
node('CrestBrow',boxGold,[0,5.4,1.55],[1.25,.12,.12]);
for(const side of[-1,1]){
  node(`LanternArm_${side}`,boxGold,[side*5.15,3.65,.65],[.9,.12,.12]);
  node(`LanternCup_${side}`,cylGold,[side*5.55,3.28,.65],[.25,.5,.25]);
}
const bin=new Uint8Array(byteLength);let cur=0;for(const c of chunks){bin.set(c,cur);cur+=c.byteLength;}
const gltf={asset:{version:'2.0',generator:'Ninjago Tournament clean-room Chen gate generator'},scene:0,scenes:[{name:'ChenArenaGate',nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,buffers:[{byteLength:bin.byteLength}],bufferViews,accessors};
let json=enc.encode(JSON.stringify(gltf));const jp=pad4(json.byteLength),jc=new Uint8Array(jp);jc.fill(0x20);jc.set(json);const bpadded=pad4(bin.byteLength),bc=new Uint8Array(bpadded);bc.set(bin);const total=12+8+jc.byteLength+8+bc.byteLength,out=new ArrayBuffer(total),view=new DataView(out),bytes=new Uint8Array(out);let o=0;
view.setUint32(o,0x46546c67,true);o+=4;view.setUint32(o,2,true);o+=4;view.setUint32(o,total,true);o+=4;view.setUint32(o,jc.byteLength,true);o+=4;view.setUint32(o,0x4e4f534a,true);o+=4;bytes.set(jc,o);o+=jc.byteLength;view.setUint32(o,bc.byteLength,true);o+=4;view.setUint32(o,0x004e4942,true);o+=4;bytes.set(bc,o);
await mkdir(dirname(OUTPUT),{recursive:true});
await writeFile(OUTPUT,new Uint8Array(out));
console.log(`Generated ${OUTPUT} (${total} bytes)`);

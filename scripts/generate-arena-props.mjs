import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const enc = new TextEncoder();
const pad4 = (n) => (n + 3) & ~3;

function box() {
  return [[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],
    [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]];
}
function cylinder(seg=18) {
  const p=[],i=[];
  for (const y of [-.5,.5]) for (let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),y,Math.sin(a));}
  p.push(0,-.5,0,0,.5,0); const b=seg*2,t=b+1;
  for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,seg+n,s,seg+n,seg+s,b,n,s,t,seg+s,seg+n);}
  return [p,i];
}
function cone(seg=10) {
  const p=[],i=[]; for(let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),-.5,Math.sin(a));}
  p.push(0,.5,0,0,-.5,0); const tip=seg,base=seg+1;
  for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,tip,base,n,s);} return [p,i];
}
function torus(major=1,minor=.1,majSeg=28,minSeg=7) {
  const p=[],i=[];
  for(let a=0;a<=majSeg;a++){const u=a/majSeg*Math.PI*2;for(let b=0;b<=minSeg;b++){const v=b/minSeg*Math.PI*2,r=major+minor*Math.cos(v);p.push(r*Math.cos(u),minor*Math.sin(v),r*Math.sin(u));}}
  for(let a=0;a<majSeg;a++)for(let b=0;b<minSeg;b++){const x=a*(minSeg+1)+b,y=x+minSeg+1;i.push(x,y,x+1,y,y+1,x+1);}
  return [p,i];
}
function sphere(lat=8,lon=12) {
  const p=[],i=[];
  for(let y=0;y<=lat;y++){const v=y/lat,phi=v*Math.PI;for(let x=0;x<=lon;x++){const u=x/lon,th=u*Math.PI*2;p.push(Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));}}
  for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;i.push(a,b,a+1,b,b+1,a+1);}
  return [p,i];
}
function normals(pos,idx){
  const n=new Float32Array(pos.length);
  for(let k=0;k<idx.length;k+=3){const a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3,ab=[pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]],ac=[pos[c]-pos[a],pos[c+1]-pos[a+1],pos[c+2]-pos[a+2]],nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];for(const o of[a,b,c]){n[o]+=nn[0];n[o+1]+=nn[1];n[o+2]+=nn[2];}}
  for(let k=0;k<n.length;k+=3){const l=Math.hypot(n[k],n[k+1],n[k+2])||1;n[k]/=l;n[k+1]/=l;n[k+2]/=l;} return n;
}
async function writeAsset(output, sceneName, materials, build) {
  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[]; let byteLength=0;
  const push=(typed,target)=>{const src=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength),padded=new Uint8Array(pad4(src.byteLength));padded.set(src);const offset=byteLength;chunks.push(padded);byteLength+=padded.byteLength;bufferViews.push({buffer:0,byteOffset:offset,byteLength:src.byteLength,target});return bufferViews.length-1;};
  const mm=(v)=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<v.length;k+=3)for(let a=0;a<3;a++){min[a]=Math.min(min[a],v[k+a]);max[a]=Math.max(max[a],v[k+a]);}return{min,max};};
  const acc=(typed,type,componentType,target,min,max)=>{const bufferView=push(typed,target),count=typed.length/(type==='VEC3'?3:1),a={bufferView,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessors.length-1;};
  const mesh=(name,p,i,material)=>{const pos=new Float32Array(p),idx=new Uint16Array(i),bounds=mm(pos),pa=acc(pos,'VEC3',5126,34962,bounds.min,bounds.max),na=acc(normals(pos,idx),'VEC3',5126,34962),ia=acc(idx,'SCALAR',5123,34963,[0],[Math.max(...i)]);meshes.push({name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material}]});return meshes.length-1;};
  const qX=(a)=>[Math.sin(a/2),0,0,Math.cos(a/2)], qY=(a)=>[0,Math.sin(a/2),0,Math.cos(a/2)], qZ=(a)=>[0,0,Math.sin(a/2),Math.cos(a/2)];
  const node=(name,meshIndex,t=[0,0,0],s=[1,1,1],r)=>{const n={name,mesh:meshIndex,translation:t,scale:s};if(r)n.rotation=r;nodes.push(n);return nodes.length-1;};
  build({mesh,node,qX,qY,qZ});
  const bin=new Uint8Array(byteLength);let cur=0;for(const c of chunks){bin.set(c,cur);cur+=c.byteLength;}
  const gltf={asset:{version:'2.0',generator:'Ninjago Tournament clean-room arena prop generator'},scene:0,scenes:[{name:sceneName,nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,buffers:[{byteLength:bin.byteLength}],bufferViews,accessors};
  let json=enc.encode(JSON.stringify(gltf));const jp=pad4(json.byteLength),jc=new Uint8Array(jp);jc.fill(0x20);jc.set(json);const bp=pad4(bin.byteLength),bc=new Uint8Array(bp);bc.set(bin);
  const total=12+8+jc.byteLength+8+bc.byteLength,out=new ArrayBuffer(total),view=new DataView(out),bytes=new Uint8Array(out);let o=0;
  view.setUint32(o,0x46546c67,true);o+=4;view.setUint32(o,2,true);o+=4;view.setUint32(o,total,true);o+=4;view.setUint32(o,jc.byteLength,true);o+=4;view.setUint32(o,0x4e4f534a,true);o+=4;bytes.set(jc,o);o+=jc.byteLength;view.setUint32(o,bc.byteLength,true);o+=4;view.setUint32(o,0x004e4942,true);o+=4;bytes.set(bc,o);
  await mkdir(dirname(output),{recursive:true}); await writeFile(output,new Uint8Array(out)); console.log(`Generated ${output} (${total} bytes)`);
}

const stone={name:'Stone',pbrMetallicRoughness:{baseColorFactor:[0.21,0.22,0.24,1],metallicFactor:0.02,roughnessFactor:0.93}};
const dark={name:'DarkStone',pbrMetallicRoughness:{baseColorFactor:[0.12,0.13,0.15,1],metallicFactor:0.02,roughnessFactor:0.97}};
const serpent={name:'SerpentRed',pbrMetallicRoughness:{baseColorFactor:[0.38,0.12,0.25,1],metallicFactor:0.04,roughnessFactor:0.56}};
const bronze={name:'Bronze',pbrMetallicRoughness:{baseColorFactor:[0.66,0.47,0.15,1],metallicFactor:0.52,roughnessFactor:0.34}};
const eye={name:'EyeGold',pbrMetallicRoughness:{baseColorFactor:[1,.78,.18,1],metallicFactor:.08,roughnessFactor:.2},emissiveFactor:[.3,.16,.02]};

await writeAsset(resolve('public/assets/models/arena/serpent-column.glb'),'ChenSerpentColumn',[stone,dark,serpent,bronze,eye],({mesh,node,qX,qY,qZ})=>{
  const [bp,bi]=box(),[cp,ci]=cylinder(18),[tp,ti]=torus(),[kp,ki]=cone(10),[sp,si]=sphere();
  const boxDark=mesh('DarkRib',bp,bi,1),cStone=mesh('StoneCylinder',cp,ci,0),cDark=mesh('DarkCylinder',cp,ci,1),cBronze=mesh('BronzeCylinder',cp,ci,3),tSerpent=mesh('SerpentCoil',tp,ti,2),tBronze=mesh('BronzeRing',tp,ti,3),coneSerpent=mesh('SerpentHead',kp,ki,2),coneDark=mesh('DarkSpike',kp,ki,1),sphereEye=mesh('Eye',sp,si,4);
  node('Plinth',cDark,[0,.18,0],[1.12,.36,1.12]); node('Base',cStone,[0,.56,0],[.95,.62,.95]); node('BaseRing',tBronze,[0,.78,0],[.93,.93,.93],qX(Math.PI/2));
  node('Shaft',cStone,[0,2.9,0],[.72,4.7,.72]); for(let r=0;r<6;r++){const a=r*Math.PI/3;node(`Rib_${r}`,boxDark,[Math.cos(a)*.71,2.9,Math.sin(a)*.71],[.08,4.25,.16],qY(-a));}
  for(let i=0;i<5;i++)node(`SerpentCoil_${i}`,tSerpent,[0,1.05+i*.82,0],[.82+i*.012,.82+i*.012,.82+i*.012],qX(Math.PI/2+i*.06));
  node('Cap',cDark,[0,5.26,0],[1.02,.36,1.02]); node('Crown',tBronze,[0,5.4,0],[1.02,1.02,1.02],qX(Math.PI/2)); node('TopDisk',cBronze,[0,5.58,0],[.72,.2,.72]);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;node(`CrownSpike_${i}`,coneDark,[Math.cos(a)*.58,5.95,Math.sin(a)*.58],[.13,.72,.13],qZ(-a*.08));}
  node('SerpentHead',coneSerpent,[.74,4.82,.2],[.34,.78,.34],qZ(-.58)); node('EyeLeft',sphereEye,[.72,4.98,.42],[.055,.055,.055]); node('EyeRight',sphereEye,[.91,4.93,.22],[.055,.055,.055]);
});

const wood={name:'DarkWood',pbrMetallicRoughness:{baseColorFactor:[.26,.13,.07,1],metallicFactor:.02,roughnessFactor:.82}};
const gold={name:'GongBronze',pbrMetallicRoughness:{baseColorFactor:[.7,.48,.13,1],metallicFactor:.62,roughnessFactor:.28}};
const red={name:'ChenRed',pbrMetallicRoughness:{baseColorFactor:[.42,.1,.14,1],metallicFactor:.03,roughnessFactor:.7}};
await writeAsset(resolve('public/assets/models/arena/chen-gong.glb'),'ChenArenaGong',[wood,gold,red],({mesh,node,qX,qY,qZ})=>{
  const [bp,bi]=box(),[cp,ci]=cylinder(28),[tp,ti]=torus();
  const bWood=mesh('WoodBox',bp,bi,0),bRed=mesh('RedBox',bp,bi,2),cGold=mesh('GongDisc',cp,ci,1),tGold=mesh('GongRing',tp,ti,1);
  node('LeftFoot',bWood,[-.86,.12,0],[.68,.24,.8]); node('RightFoot',bWood,[.86,.12,0],[.68,.24,.8]);
  node('LeftPost',bWood,[-.9,1.75,0],[.22,3.3,.22]); node('RightPost',bWood,[.9,1.75,0],[.22,3.3,.22]); node('TopBeam',bWood,[0,3.28,0],[2.35,.22,.25]);
  node('TopBanner',bRed,[0,3.62,0],[1.15,.45,.12]); node('Gong',cGold,[0,1.86,.02],[1.18,.13,1.18],qZ(Math.PI/2)); node('GongRing',tGold,[0,1.86,.13],[1.05,1.05,1.05],qY(Math.PI/2));
  node('GongBoss',cGold,[0,1.86,.17],[.24,.16,.24],qZ(Math.PI/2)); node('Mallet',bWood,[1.3,1.15,.18],[.12,1.25,.12],qZ(-.35)); node('MalletHead',bRed,[1.48,1.68,.18],[.4,.22,.22],qZ(-.35));
});

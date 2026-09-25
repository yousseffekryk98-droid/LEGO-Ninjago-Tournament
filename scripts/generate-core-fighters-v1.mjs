import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const fighters = [
  ['lloyd-tournament',0x28a745,0xd8c66a,0xf2c64f],
  ['kai-tournament',0xc62828,0xf5a623,0xf2c64f],
  ['jay-tournament',0x1d5fbf,0xf4d03f,0xf2c64f],
  ['cole-tournament',0x202124,0xd9822b,0xf2c64f],
  ['zane-techno',0xe7ecef,0x7fd8ff,0xd8e3e8],
  ['zane-zx',0xe4e8ea,0xbecbd2,0xd8e3e8],
  ['nya',0x7c1f2a,0x71d7ff,0xf2c64f],
  ['master-garmadon',0x2b2d31,0xe5dfc7,0xb7b1a4],
  ['master-chen',0x8f2d28,0xd3aa58,0xf2c64f],
  ['skylor',0xd56b1f,0xffc04d,0xf2c64f]
];

const enc=new TextEncoder(),pad4=n=>(n+3)&~3;
const rgb=n=>[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,1];
function box(){return[[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]];}
function cylinder(seg=24){const p=[],i=[];for(const y of[-.5,.5])for(let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),y,Math.sin(a));}p.push(0,-.5,0,0,.5,0);const b=seg*2,t=b+1;for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,seg+n,s,seg+n,seg+s,b,n,s,t,seg+s,seg+n);}return[p,i];}
function sphere(lat=8,lon=16){const p=[],i=[];for(let y=0;y<=lat;y++){const v=y/lat,phi=v*Math.PI;for(let x=0;x<=lon;x++){const u=x/lon,th=u*Math.PI*2;p.push(Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));}}for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;i.push(a,b,a+1,b,b+1,a+1);}return[p,i];}
function normals(pos,idx){const n=new Float32Array(pos.length);for(let k=0;k<idx.length;k+=3){const a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3,ab=[pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]],ac=[pos[c]-pos[a],pos[c+1]-pos[a+1],pos[c+2]-pos[a+2]],nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];for(const o of[a,b,c]){n[o]+=nn[0];n[o+1]+=nn[1];n[o+2]+=nn[2];}}for(let k=0;k<n.length;k+=3){const l=Math.hypot(n[k],n[k+1],n[k+2])||1;n[k]/=l;n[k+1]/=l;n[k+2]/=l;}return n;}
async function generate(id,primary,accent,skin){
  const materials=[
    {name:'Primary',pbrMetallicRoughness:{baseColorFactor:rgb(primary),metallicFactor:id.startsWith('zane')?.22:.03,roughnessFactor:.34}},
    {name:'Accent',pbrMetallicRoughness:{baseColorFactor:rgb(accent),metallicFactor:.16,roughnessFactor:.28}},
    {name:'Skin',pbrMetallicRoughness:{baseColorFactor:rgb(skin),metallicFactor:id.startsWith('zane')?.16:0,roughnessFactor:.3}},
    {name:'Dark',pbrMetallicRoughness:{baseColorFactor:[.055,.06,.07,1],metallicFactor:.05,roughnessFactor:.44}}
  ];
  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[];let byteLength=0;
  const push=(typed,target)=>{const src=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength),padded=new Uint8Array(pad4(src.byteLength));padded.set(src);const off=byteLength;chunks.push(padded);byteLength+=padded.byteLength;bufferViews.push({buffer:0,byteOffset:off,byteLength:src.byteLength,target});return bufferViews.length-1;};
  const mm=v=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<v.length;k+=3)for(let a=0;a<3;a++){min[a]=Math.min(min[a],v[k+a]);max[a]=Math.max(max[a],v[k+a]);}return{min,max};};
  const acc=(typed,type,componentType,target,min,max)=>{const bufferView=push(typed,target),count=typed.length/(type==='VEC3'?3:1),a={bufferView,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessors.length-1;};
  const mesh=(name,p,i,material)=>{const pos=new Float32Array(p),idx=new Uint16Array(i),bounds=mm(pos),pa=acc(pos,'VEC3',5126,34962,bounds.min,bounds.max),na=acc(normals(pos,idx),'VEC3',5126,34962),ia=acc(idx,'SCALAR',5123,34963,[0],[Math.max(...i)]);meshes.push({name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material}]});return meshes.length-1;};
  const qZ=a=>[0,0,Math.sin(a/2),Math.cos(a/2)];
  const node=(name,meshIndex,t=[0,0,0],s=[1,1,1],r,children)=>{const n={name,translation:t,scale:s};if(meshIndex!==null)n.mesh=meshIndex;if(r)n.rotation=r;if(children?.length)n.children=children;nodes.push(n);return nodes.length-1;};
  const [bp,bi]=box(),[cp,ci]=cylinder(),[sp,si]=sphere();
  const primaryBox=mesh('PrimaryBox',bp,bi,0),accentBox=mesh('AccentBox',bp,bi,1),skinCyl=mesh('SkinCylinder',cp,ci,2),primaryCyl=mesh('PrimaryCylinder',cp,ci,0),accentCyl=mesh('AccentCylinder',cp,ci,1),skinSphere=mesh('SkinSphere',sp,si,2),darkBox=mesh('DarkBox',bp,bi,3);

  const torsoBody=node('torsoBody',primaryBox,[0,0,0],[.78,.92,.5]);
  const chest=node('torsoChest',accentBox,[0,.04,.275],[.55,.54,.035],qZ(-.25));
  const collar=node('torsoCollar',darkBox,[0,.34,.28],[.46,.08,.04]);
  const torso=node('torso',null,[0,1.3,0],[1,1,1],undefined,[torsoBody,chest,collar]);

  const headCore=node('headCore',skinCyl,[0,0,0],[.34,.5,.34]);
  const brow=node('headBrow',darkBox,[0,.12,.335],[.42,.055,.035]);
  const head=node('head',null,[0,2.02,0],[1,1,1],undefined,[headCore,brow]);

  const roots=[torso,head];
  for(const side of[-1,1]){
    const armBody=node(side<0?'leftArmBody':'rightArmBody',primaryCyl,[side*.05,-.31,0],[.12,.46,.12],qZ(side*.05));
    const cuff=node(side<0?'leftArmCuff':'rightArmCuff',accentCyl,[side*.1,-.54,0],[.14,.17,.14],qZ(side*.1));
    const hand=node(side<0?'leftHandAuthored':'rightHandAuthored',skinSphere,[side*.13,-.72,.02],[.13,.13,.12]);
    const arm=node(side<0?'leftArm':'rightArm',null,[side*.5,1.58,0],[1,1,1],qZ(side*.18),[armBody,cuff,hand]);
    roots.push(arm);

    const legBody=node(side<0?'leftLegBody':'rightLegBody',primaryBox,[0,0,0],[.32,.72,.42]);
    const knee=node(side<0?'leftKneePlate':'rightKneePlate',accentBox,[0,.1,.23],[.25,.12,.04],qZ(side*.05));
    const leg=node(side<0?'leftLeg':'rightLeg',null,[side*.23,.45,0],[1,1,1],undefined,[legBody,knee]);
    roots.push(leg);
  }

  const bin=new Uint8Array(byteLength);let cur=0;for(const c of chunks){bin.set(c,cur);cur+=c.byteLength;}
  const gltf={asset:{version:'2.0',generator:'Ninjago Tournament clean-room authored fighter generator'},scene:0,scenes:[{name:`Fighter_${id}`,nodes:roots}],nodes,meshes,materials,buffers:[{byteLength:bin.byteLength}],bufferViews,accessors};
  let json=enc.encode(JSON.stringify(gltf));const jp=pad4(json.byteLength),jc=new Uint8Array(jp);jc.fill(0x20);jc.set(json);const bpadded=pad4(bin.byteLength),bc=new Uint8Array(bpadded);bc.set(bin),total=12+8+jc.byteLength+8+bc.byteLength,out=new ArrayBuffer(total),view=new DataView(out),bytes=new Uint8Array(out);let o=0;
  view.setUint32(o,0x46546c67,true);o+=4;view.setUint32(o,2,true);o+=4;view.setUint32(o,total,true);o+=4;view.setUint32(o,jc.byteLength,true);o+=4;view.setUint32(o,0x4e4f534a,true);o+=4;bytes.set(jc,o);o+=jc.byteLength;view.setUint32(o,bc.byteLength,true);o+=4;view.setUint32(o,0x004e4942,true);o+=4;bytes.set(bc,o);
  const output=resolve(`public/assets/models/fighters/variants/${id}/authored-v1.glb`);await mkdir(dirname(output),{recursive:true});await writeFile(output,new Uint8Array(out));console.log(`Generated ${output} (${total} bytes)`);
}
for(const fighter of fighters) await generate(...fighter);

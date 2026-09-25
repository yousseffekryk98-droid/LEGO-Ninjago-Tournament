import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const fighters = [
  { id:'lloyd-tournament', primary:0x218f3f, accent:0xd8b84b, skin:0xf2c64f, hair:0xd8c8a2, secondary:0x11622f, eyes:0x26944c, style:'lloyd' },
  { id:'kai-tournament', primary:0xb91f25, accent:0xd79b2f, skin:0xf2c64f, hair:0x19191b, secondary:0x252329, eyes:0x211c19, style:'kai' },
  { id:'jay-tournament', primary:0x236bc0, accent:0xb87737, skin:0xf2c64f, hair:0x8f3e28, secondary:0x5b3b25, eyes:0x251d18, style:'jay' },
  { id:'cole-tournament', primary:0x202124, accent:0xd9822b, skin:0xf2c64f, hair:0x171719, secondary:0x3c2e25, eyes:0x211c19, style:'generic' },
  { id:'zane-techno', primary:0xe7ecef, accent:0x7fd8ff, skin:0xd8e3e8, hair:0xe6edf0, secondary:0x8ba1ad, eyes:0x5ac6e8, style:'generic' },
  { id:'zane-zx', primary:0xe4e8ea, accent:0xbecbd2, skin:0xd8e3e8, hair:0xe9eef0, secondary:0x9aa8ae, eyes:0x5ac6e8, style:'generic' },
  { id:'nya', primary:0x7c1f2a, accent:0x71d7ff, skin:0xf2c64f, hair:0x292125, secondary:0x322a36, eyes:0x211c19, style:'generic' },
  { id:'master-garmadon', primary:0x2b2d31, accent:0xe5dfc7, skin:0xb7b1a4, hair:0x171719, secondary:0x5e5548, eyes:0x7fdf74, style:'generic' },
  { id:'master-chen', primary:0x8f2d28, accent:0xd3aa58, skin:0xf2c64f, hair:0x3b2622, secondary:0x4f2230, eyes:0x211c19, style:'generic' },
  { id:'skylor', primary:0xd56b1f, accent:0xffc04d, skin:0xf2c64f, hair:0xa94c25, secondary:0x6d2d27, eyes:0x211c19, style:'generic' }
];

const enc = new TextEncoder();
const pad4 = (n) => (n + 3) & ~3;
const rgb = (n) => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];

function box() {
  return [
    [-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],
    [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]
  ];
}
function cylinder(seg = 24) {
  const p = [], i = [];
  for (const y of [-.5,.5]) {
    for (let s=0;s<seg;s++) {
      const a = Math.PI * 2 * s / seg;
      p.push(Math.cos(a), y, Math.sin(a));
    }
  }
  p.push(0,-.5,0,0,.5,0);
  const bottom = seg * 2, top = bottom + 1;
  for (let s=0;s<seg;s++) {
    const n=(s+1)%seg;
    i.push(s,n,seg+n,s,seg+n,seg+s,bottom,n,s,top,seg+s,seg+n);
  }
  return [p,i];
}
function sphere(lat=10, lon=18) {
  const p=[], i=[];
  for(let y=0;y<=lat;y++) {
    const v=y/lat, phi=v*Math.PI;
    for(let x=0;x<=lon;x++) {
      const u=x/lon, th=u*Math.PI*2;
      p.push(Math.sin(phi)*Math.cos(th), Math.cos(phi), Math.sin(phi)*Math.sin(th));
    }
  }
  for(let y=0;y<lat;y++) {
    for(let x=0;x<lon;x++) {
      const a=y*(lon+1)+x,b=a+lon+1;
      i.push(a,b,a+1,b,b+1,a+1);
    }
  }
  return [p,i];
}
function cone(seg=14) {
  const p=[],i=[];
  for(let s=0;s<seg;s++) {
    const a=Math.PI*2*s/seg;
    p.push(Math.cos(a),-.5,Math.sin(a));
  }
  p.push(0,.5,0,0,-.5,0);
  const tip=seg, base=seg+1;
  for(let s=0;s<seg;s++) {
    const n=(s+1)%seg;
    i.push(s,n,tip,base,n,s);
  }
  return [p,i];
}
function torus(major=1,minor=.1,majSeg=28,minSeg=8) {
  const p=[],i=[];
  for(let a=0;a<=majSeg;a++) {
    const u=a/majSeg*Math.PI*2;
    for(let b=0;b<=minSeg;b++) {
      const v=b/minSeg*Math.PI*2;
      const r=major+minor*Math.cos(v);
      p.push(r*Math.cos(u),minor*Math.sin(v),r*Math.sin(u));
    }
  }
  for(let a=0;a<majSeg;a++) {
    for(let b=0;b<minSeg;b++) {
      const x=a*(minSeg+1)+b,y=x+minSeg+1;
      i.push(x,y,x+1,y,y+1,x+1);
    }
  }
  return [p,i];
}
function normals(pos,idx) {
  const n=new Float32Array(pos.length);
  for(let k=0;k<idx.length;k+=3) {
    const a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3;
    const ab=[pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]];
    const ac=[pos[c]-pos[a],pos[c+1]-pos[a+1],pos[c+2]-pos[a+2]];
    const nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    for(const o of [a,b,c]) { n[o]+=nn[0];n[o+1]+=nn[1];n[o+2]+=nn[2]; }
  }
  for(let k=0;k<n.length;k+=3) {
    const l=Math.hypot(n[k],n[k+1],n[k+2])||1;
    n[k]/=l;n[k+1]/=l;n[k+2]/=l;
  }
  return n;
}

async function generate(profile) {
  const {id,primary,accent,skin,hair,secondary,eyes,style}=profile;
  const isZane=id.startsWith('zane');
  const materials=[
    {name:'Primary',pbrMetallicRoughness:{baseColorFactor:rgb(primary),metallicFactor:isZane ? .2 : .03,roughnessFactor:.3}},
    {name:'Accent',pbrMetallicRoughness:{baseColorFactor:rgb(accent),metallicFactor:.22,roughnessFactor:.27}},
    {name:'Skin',pbrMetallicRoughness:{baseColorFactor:rgb(skin),metallicFactor:isZane ? .15 : 0,roughnessFactor:.24}},
    {name:'Dark',pbrMetallicRoughness:{baseColorFactor:[.045,.047,.052,1],metallicFactor:.05,roughnessFactor:.35}},
    {name:'Hair',pbrMetallicRoughness:{baseColorFactor:rgb(hair),metallicFactor:.02,roughnessFactor:.25}},
    {name:'Secondary',pbrMetallicRoughness:{baseColorFactor:rgb(secondary),metallicFactor:.05,roughnessFactor:.42}},
    {name:'Eye',pbrMetallicRoughness:{baseColorFactor:rgb(eyes),metallicFactor:0,roughnessFactor:.12}},
    {name:'White',pbrMetallicRoughness:{baseColorFactor:[.96,.96,.92,1],metallicFactor:0,roughnessFactor:.2}}
  ];

  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[];let byteLength=0;
  const push=(typed,target)=>{
    const src=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength);
    const padded=new Uint8Array(pad4(src.byteLength));padded.set(src);
    const off=byteLength;chunks.push(padded);byteLength+=padded.byteLength;
    bufferViews.push({buffer:0,byteOffset:off,byteLength:src.byteLength,target});
    return bufferViews.length-1;
  };
  const mm=(v)=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let k=0;k<v.length;k+=3) for(let a=0;a<3;a++){min[a]=Math.min(min[a],v[k+a]);max[a]=Math.max(max[a],v[k+a]);}
    return {min,max};
  };
  const acc=(typed,type,componentType,target,min,max)=>{
    const bufferView=push(typed,target),count=typed.length/(type==='VEC3'?3:1);
    const a={bufferView,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessors.length-1;
  };
  const mesh=(name,p,i,material)=>{
    const pos=new Float32Array(p),idx=new Uint16Array(i),bounds=mm(pos);
    const pa=acc(pos,'VEC3',5126,34962,bounds.min,bounds.max);
    const na=acc(normals(pos,idx),'VEC3',5126,34962);
    const ia=acc(idx,'SCALAR',5123,34963,[0],[Math.max(...i)]);
    meshes.push({name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material}]});
    return meshes.length-1;
  };
  const qX=(a)=>[Math.sin(a/2),0,0,Math.cos(a/2)];
  const qY=(a)=>[0,Math.sin(a/2),0,Math.cos(a/2)];
  const qZ=(a)=>[0,0,Math.sin(a/2),Math.cos(a/2)];
  const node=(name,meshIndex,t=[0,0,0],s=[1,1,1],r,children)=>{
    const n={name,translation:t,scale:s};
    if(meshIndex!==null)n.mesh=meshIndex;
    if(r)n.rotation=r;
    if(children?.length)n.children=children;
    nodes.push(n);return nodes.length-1;
  };

  const [bp,bi]=box(),[cp,ci]=cylinder(28),[sp,si]=sphere(11,20),[kp,ki]=cone(14),[tp,ti]=torus();
  const primaryBox=mesh('PrimaryBox',bp,bi,0);
  const accentBox=mesh('AccentBox',bp,bi,1);
  const skinCyl=mesh('SkinCylinder',cp,ci,2);
  const primaryCyl=mesh('PrimaryCylinder',cp,ci,0);
  const accentCyl=mesh('AccentCylinder',cp,ci,1);
  const skinSphere=mesh('SkinSphere',sp,si,2);
  const darkBox=mesh('DarkBox',bp,bi,3);
  const darkCyl=mesh('DarkCylinder',cp,ci,3);
  const hairSphere=mesh('HairSphere',sp,si,4);
  const hairCone=mesh('HairCone',kp,ki,4);
  const secondaryBox=mesh('SecondaryBox',bp,bi,5);
  const secondaryCyl=mesh('SecondaryCylinder',cp,ci,5);
  const eyeSphere=mesh('EyeSphere',sp,si,6);
  const whiteSphere=mesh('WhiteSphere',sp,si,7);
  const accentTorus=mesh('AccentTorus',tp,ti,1);

  const torsoChildren=[];
  torsoChildren.push(node('torsoBody',primaryBox,[0,0,0],[.78,.9,.48]));
  torsoChildren.push(node('torsoBelt',secondaryBox,[0,-.31,.265],[.72,.13,.055]));
  torsoChildren.push(node('torsoSashA',accentBox,[.02,.04,.27],[.13,.75,.035],qZ(-.63)));
  torsoChildren.push(node('torsoSashB',secondaryBox,[-.13,.06,.285],[.11,.73,.035],qZ(.53)));
  torsoChildren.push(node('torsoCollar',darkBox,[0,.35,.27],[.54,.09,.05]));
  torsoChildren.push(node('torsoChestPanel',secondaryBox,[0,.02,.29],[.4,.34,.025]));
  torsoChildren.push(node('torsoEmblem',accentCyl,[0,-.22,.335],[.105,.035,.105],qX(Math.PI/2)));

  if(style==='lloyd') {
    torsoChildren.push(node('leftShoulderGold',accentBox,[-.53,.31,.02],[.34,.15,.62],qZ(.18)));
    torsoChildren.push(node('rightShoulderGold',accentBox,[.53,.31,.02],[.34,.15,.62],qZ(-.18)));
    torsoChildren.push(node('leftShoulderEdge',secondaryBox,[-.58,.33,.04],[.1,.22,.68],qZ(.28)));
    torsoChildren.push(node('rightShoulderEdge',secondaryBox,[.58,.33,.04],[.1,.22,.68],qZ(-.28)));
    torsoChildren.push(node('goldChestStripe',accentBox,[.14,.08,.325],[.07,.64,.022],qZ(-.6)));
  } else if(style==='kai') {
    torsoChildren.push(node('leftShoulderArmor',darkBox,[-.56,.33,.01],[.4,.2,.65],qZ(.15)));
    torsoChildren.push(node('rightShoulderArmor',darkBox,[.56,.33,.01],[.4,.2,.65],qZ(-.15)));
    torsoChildren.push(node('leftShoulderSpike',hairCone,[-.68,.52,.02],[.13,.48,.13],qZ(-.38)));
    torsoChildren.push(node('rightShoulderSpike',hairCone,[.68,.52,.02],[.13,.48,.13],qZ(.38)));
    torsoChildren.push(node('kaiGoldTrim',accentBox,[.17,.05,.33],[.075,.68,.022],qZ(-.48)));
  } else if(style==='jay') {
    torsoChildren.push(node('jayShoulderWrap',secondaryBox,[-.48,.3,.02],[.34,.2,.58],qZ(.2)));
    torsoChildren.push(node('jayChestStrap',secondaryBox,[.08,.04,.325],[.15,.83,.035],qZ(.62)));
    torsoChildren.push(node('jayBuckle',accentCyl,[.22,-.16,.365],[.105,.04,.105],qX(Math.PI/2)));
    torsoChildren.push(node('jayBluePanel',accentBox,[-.21,.02,.33],[.12,.58,.022],qZ(-.48)));
  }
  const torso=node('torso',null,[0,1.3,0],[1,1,1],undefined,torsoChildren);

  const headChildren=[];
  headChildren.push(node('headCore',skinCyl,[0,0,0],[.36,.5,.36]));

  for(const side of [-1,1]) {
    headChildren.push(node(side<0?'leftEyeWhite':'rightEyeWhite',whiteSphere,[side*.115,.055,.347],[.074,.088,.026]));
    headChildren.push(node(side<0?'leftEye':'rightEye',eyeSphere,[side*.115,.055,.369],[.041,.055,.018]));
    headChildren.push(node(side<0?'leftPupil':'rightPupil',darkCyl,[side*.115,.055,.381],[.022,.012,.022],qX(Math.PI/2)));
  }
  const browTilt=style==='kai' ? .25 : style==='lloyd' ? .12 : .05;
  headChildren.push(node('leftBrow',darkBox,[-.12,.17,.37],[.145,.035,.023],qZ(-browTilt)));
  headChildren.push(node('rightBrow',darkBox,[.12,.17,.37],[.145,.035,.023],qZ(browTilt)));
  if(style==='kai') {
    headChildren.push(node('mouthA',darkBox,[-.035,-.13,.373],[.11,.025,.018],qZ(-.12)));
    headChildren.push(node('mouthB',darkBox,[.072,-.145,.373],[.11,.025,.018],qZ(.18)));
  } else if(style==='jay') {
    headChildren.push(node('mouthA',darkBox,[-.045,-.12,.373],[.11,.022,.018],qZ(.16)));
    headChildren.push(node('mouthB',darkBox,[.065,-.105,.373],[.11,.022,.018],qZ(-.13)));
  } else {
    headChildren.push(node('mouth',darkBox,[0,-.14,.373],[.18,.026,.018]));
  }

  if(style==='lloyd') {
    headChildren.push(node('headbandFront',secondaryBox,[0,.285,.35],[.39,.105,.045]));
    headChildren.push(node('hairCap',hairSphere,[0,.34,-.02],[.43,.23,.42]));
    headChildren.push(node('hairSweepLeft',hairSphere,[-.22,.28,.15],[.21,.29,.2],qZ(.45)));
    headChildren.push(node('hairSweepRight',hairSphere,[.19,.31,.14],[.2,.31,.2],qZ(-.42)));
    headChildren.push(node('hairSideLeft',hairSphere,[-.34,.08,.02],[.12,.3,.18],qZ(.13)));
    headChildren.push(node('hairSideRight',hairSphere,[.34,.09,.02],[.12,.3,.18],qZ(-.13)));
    headChildren.push(node('headbandKnot',secondaryCyl,[-.36,.26,-.12],[.08,.13,.08],qZ(.65)));
    headChildren.push(node('headbandTail',secondaryBox,[-.41,.16,-.15],[.09,.28,.035],qZ(.25)));
  } else if(style==='kai') {
    headChildren.push(node('kaiHeadband',primaryBox,[0,.285,.35],[.39,.09,.045]));
    headChildren.push(node('hairCap',hairSphere,[0,.36,-.02],[.42,.22,.42]));
    const spikes=[
      [-.29,.48,-.08,.16,.52,-.15],[-.13,.56,.02,.17,.6,-.08],[.05,.59,-.03,.18,.65,.02],
      [.22,.53,.02,.17,.56,.14],[.32,.4,-.04,.14,.48,.22],[-.36,.34,.02,.13,.46,-.22]
    ];
    spikes.forEach((p,idx)=>headChildren.push(node(`hairSpike${idx}`,hairCone,[p[0],p[1],p[2]],[p[3],p[4],p[3]],qZ(p[5]))));
    headChildren.push(node('hairFringeLeft',hairSphere,[-.18,.26,.23],[.18,.18,.16],qZ(.35)));
    headChildren.push(node('hairFringeRight',hairSphere,[.15,.28,.25],[.18,.17,.15],qZ(-.35)));
  } else if(style==='jay') {
    headChildren.push(node('hairCap',hairSphere,[0,.36,-.02],[.43,.23,.43]));
    const locks=[[-.29,.28,.17,.18,.2,.15],[-.14,.38,.24,.18,.18,-.15],[.05,.4,.25,.2,.18,.13],[.23,.34,.2,.18,.2,-.2],[.33,.23,.08,.13,.22,-.28]];
    locks.forEach((p,idx)=>headChildren.push(node(`hairLock${idx}`,hairSphere,[p[0],p[1],p[2]],[p[3],p[4],p[3]],qZ(p[5]))));
    headChildren.push(node('jaySideHairLeft',hairSphere,[-.35,.09,.01],[.12,.27,.17]));
    headChildren.push(node('jaySideHairRight',hairSphere,[.35,.1,.01],[.12,.26,.17]));
  } else {
    headChildren.push(node('hairCap',hairSphere,[0,.35,-.02],[.4,.18,.4]));
  }
  const head=node('head',null,[0,2.02,0],[1,1,1],undefined,headChildren);

  const roots=[torso,head];
  for(const side of[-1,1]) {
    const armChildren=[];
    armChildren.push(node(side<0?'leftArmBody':'rightArmBody',primaryCyl,[0,-.3,0],[.13,.47,.13],qZ(side*.04)));
    armChildren.push(node(side<0?'leftArmGuard':'rightArmGuard',secondaryCyl,[0,-.48,0],[.15,.18,.15],qZ(side*.04)));
    armChildren.push(node(side<0?'leftArmAccent':'rightArmAccent',accentBox,[0,-.22,.135],[.11,.2,.025],qZ(side*.16)));
    armChildren.push(node(side<0?'leftHandAuthored':'rightHandAuthored',skinSphere,[side*.03,-.7,.02],[.14,.14,.125]));
    const arm=node(side<0?'leftArm':'rightArm',null,[side*.51,1.59,0],[1,1,1],qZ(side*.18),armChildren);
    roots.push(arm);

    const legChildren=[];
    legChildren.push(node(side<0?'leftLegBody':'rightLegBody',primaryBox,[0,0,0],[.32,.72,.42]));
    legChildren.push(node(side<0?'leftKneePlate':'rightKneePlate',secondaryBox,[0,.08,.23],[.25,.14,.045],qZ(side*.04)));
    legChildren.push(node(side<0?'leftBoot':'rightBoot',darkBox,[0,-.29,.08],[.31,.22,.49]));
    const leg=node(side<0?'leftLeg':'rightLeg',null,[side*.23,.45,0],[1,1,1],undefined,legChildren);
    roots.push(leg);
  }

  const bin=new Uint8Array(byteLength);let cur=0;for(const c of chunks){bin.set(c,cur);cur+=c.byteLength;}
  const gltf={
    asset:{version:'2.0',generator:'Ninjago Tournament clean-room high-fidelity fighter generator'},
    scene:0,
    scenes:[{name:`Fighter_${id}`,nodes:roots}],
    nodes,meshes,materials,buffers:[{byteLength:bin.byteLength}],bufferViews,accessors
  };
  const json=enc.encode(JSON.stringify(gltf));
  const jp=pad4(json.byteLength),jc=new Uint8Array(jp);jc.fill(0x20);jc.set(json);
  const bpadded=pad4(bin.byteLength),bc=new Uint8Array(bpadded);bc.set(bin);
  const total=12+8+jc.byteLength+8+bc.byteLength;
  const out=new ArrayBuffer(total),view=new DataView(out),bytes=new Uint8Array(out);let o=0;
  view.setUint32(o,0x46546c67,true);o+=4;view.setUint32(o,2,true);o+=4;view.setUint32(o,total,true);o+=4;
  view.setUint32(o,jc.byteLength,true);o+=4;view.setUint32(o,0x4e4f534a,true);o+=4;bytes.set(jc,o);o+=jc.byteLength;
  view.setUint32(o,bc.byteLength,true);o+=4;view.setUint32(o,0x004e4942,true);o+=4;bytes.set(bc,o);
  const output=resolve(`public/assets/models/fighters/${id}.glb`);
  const variantOutput=resolve(`public/assets/models/fighters/variants/${id}/authored-v2.glb`);
  await mkdir(dirname(output),{recursive:true});
  await mkdir(dirname(variantOutput),{recursive:true});
  const payload=new Uint8Array(out);
  await writeFile(output,payload);
  await writeFile(variantOutput,payload);
  console.log(`Generated ${output} and ${variantOutput} (${total} bytes, ${nodes.length} nodes)`);
}
for(const fighter of fighters) await generate(fighter);

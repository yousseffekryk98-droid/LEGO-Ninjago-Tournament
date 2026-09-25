import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ID = 'lloyd-tournament';
const PART_ROOT = resolve('third_party/ldraw-stl');
const OUTPUT = resolve('public/assets/models/fighters/variants/lloyd-tournament/exact-05b7ce43.glb');
const TARGET_HEIGHT = 2.55;
const LDRAW_TO_MM = 0.4;

const enc = new TextEncoder();
const pad4 = (n) => (n + 3) & ~3;
const rgb = (n) => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];

const PARTS = {
  torso: '973',
  head: '3626b',
  hair: '61183',
  bandana: '15619',
  hips: '3815',
  screenLeftLeg: '3816',
  screenRightLeg: '3817',
  screenLeftArm: '3818',
  screenRightArm: '3819',
  hand: '3820'
};

const PLACEMENT = {
  torso: [0, -72, 0],
  head: [0, -100, 0],
  hair: [0, -100, 0],
  bandana: [0, -84, 0],
  hips: [0, -40, 0],
  screenLeftLeg: [0, -28, 0],
  screenRightLeg: [0, -28, 0],
  screenLeftArm: [-15.552, -63, 0],
  screenRightArm: [15.552, -63, 0],
  screenLeftHand: [-23.552, -46, -10],
  screenRightHand: [23.552, -46, -10]
};

const I3 = [1,0,0, 0,1,0, 0,0,1];
const ROT_SCREEN_LEFT_ARM = [
  0.9855,-0.1699,0,
  0.1699,0.9855,0,
  0,0,1
];
const ROT_SCREEN_RIGHT_ARM = [
  0.9855,0.1699,0,
  -0.1699,0.9855,0,
  0,0,1
];
const ROT_SCREEN_LEFT_HAND = [
  0.942,0.335,0.0072,
  -0.2404,0.6906,-0.6821,
  -0.2336,0.6409,0.7312
];
const ROT_SCREEN_RIGHT_HAND = [
  0.942,-0.335,0.0072,
  0.2404,0.6906,-0.6821,
  0.2336,0.6409,0.7312
];

const RIG_PIVOTS = {
  torso: [0, 1.30, 0],
  head: [0, 2.02, 0],
  leftArm: [-0.50, 1.58, 0],
  rightArm: [0.50, 1.58, 0],
  leftLeg: [-0.23, 0.45, 0],
  rightLeg: [0.23, 0.45, 0]
};

function mul3(m, p) {
  return [
    m[0]*p[0] + m[1]*p[1] + m[2]*p[2],
    m[3]*p[0] + m[4]*p[1] + m[5]*p[2],
    m[6]*p[0] + m[7]*p[1] + m[8]*p[2]
  ];
}

function parseAsciiStl(text, partName) {
  const positions = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('vertex ')) continue;
    const bits = line.split(/\s+/);
    if (bits.length < 4) continue;
    positions.push(Number(bits[1]), Number(bits[2]), Number(bits[3]));
  }
  if (positions.length < 9 || positions.length % 9 !== 0) {
    throw new Error(`Invalid ASCII STL for ${partName}: ${positions.length / 3} vertices`);
  }
  return positions;
}

function transformPart(rawPositions, placementLdu, rotation = I3) {
  const t = placementLdu.map((v) => v * LDRAW_TO_MM);
  const out = new Array(rawPositions.length);
  for (let i = 0; i < rawPositions.length; i += 3) {
    const r = mul3(rotation, [rawPositions[i], rawPositions[i+1], rawPositions[i+2]]);
    const lx = r[0] + t[0];
    const ly = r[1] + t[1];
    const lz = r[2] + t[2];
    // LDraw is Y-down. The game's Three.js convention is Y-up and +Z is front.
    out[i] = lx;
    out[i+1] = -ly;
    out[i+2] = lz;
  }
  return out;
}

function boundsOf(parts) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const positions of Object.values(parts)) {
    for (let i = 0; i < positions.length; i += 3) {
      min[0] = Math.min(min[0], positions[i]);
      min[1] = Math.min(min[1], positions[i+1]);
      min[2] = Math.min(min[2], positions[i+2]);
      max[0] = Math.max(max[0], positions[i]);
      max[1] = Math.max(max[1], positions[i+1]);
      max[2] = Math.max(max[2], positions[i+2]);
    }
  }
  return { min, max };
}

function normalizeParts(parts) {
  const b = boundsOf(parts);
  const height = Math.max(1e-6, b.max[1] - b.min[1]);
  const scale = TARGET_HEIGHT / height;
  const centerX = (b.min[0] + b.max[0]) / 2;
  const centerZ = (b.min[2] + b.max[2]) / 2;
  const normalized = {};
  for (const [key, positions] of Object.entries(parts)) {
    const out = new Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      out[i] = (positions[i] - centerX) * scale;
      out[i+1] = (positions[i+1] - b.min[1]) * scale;
      out[i+2] = (positions[i+2] - centerZ) * scale;
    }
    normalized[key] = out;
  }
  return { parts: normalized, scale, sourceBounds: b };
}

function subtractPivot(positions, pivot) {
  const out = new Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = positions[i] - pivot[0];
    out[i+1] = positions[i+1] - pivot[1];
    out[i+2] = positions[i+2] - pivot[2];
  }
  return out;
}

function box() {
  return [[-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5, -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
    [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]];
}
function cylinder(seg=28) {
  const p=[],i=[];
  for(const y of[-.5,.5]) for(let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),y,Math.sin(a));}
  p.push(0,-.5,0,0,.5,0); const b=seg*2,t=b+1;
  for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,seg+n,s,seg+n,seg+s,b,n,s,t,seg+s,seg+n);}
  return [p,i];
}
function sphere(lat=10, lon=20) {
  const p=[],i=[];
  for(let y=0;y<=lat;y++){const v=y/lat,phi=v*Math.PI;for(let x=0;x<=lon;x++){const u=x/lon,th=u*Math.PI*2;p.push(Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));}}
  for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;i.push(a,b,a+1,b,b+1,a+1);}
  return [p,i];
}
function torus(segU=28,segV=8,arc=Math.PI*2){
  const p=[],i=[]; const R=.7,r=.3;
  for(let u=0;u<=segU;u++){
    const a=arc*u/segU;
    for(let v=0;v<=segV;v++){
      const b=2*Math.PI*v/segV, rr=R+r*Math.cos(b);
      p.push(rr*Math.cos(a), r*Math.sin(b), rr*Math.sin(a));
    }
  }
  for(let u=0;u<segU;u++)for(let v=0;v<segV;v++){
    const a=u*(segV+1)+v,b=a+segV+1;i.push(a,b,a+1,b,b+1,a+1);
  }
  return [p,i];
}
function normals(pos, idx) {
  const n = new Float32Array(pos.length);
  for(let k=0;k<idx.length;k+=3){
    const a=idx[k]*3,b=idx[k+1]*3,c=idx[k+2]*3;
    const ab=[pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]],ac=[pos[c]-pos[a],pos[c+1]-pos[a+1],pos[c+2]-pos[a+2]];
    const nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    for(const o of[a,b,c]){n[o]+=nn[0];n[o+1]+=nn[1];n[o+2]+=nn[2];}
  }
  for(let k=0;k<n.length;k+=3){const l=Math.hypot(n[k],n[k+1],n[k+2])||1;n[k]/=l;n[k+1]/=l;n[k+2]/=l;}
  return n;
}
const qEuler=(x=0,y=0,z=0)=>{
  const cx=Math.cos(x/2),sx=Math.sin(x/2),cy=Math.cos(y/2),sy=Math.sin(y/2),cz=Math.cos(z/2),sz=Math.sin(z/2);
  return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];
};

async function loadParts() {
  const file = async (part) => parseAsciiStl(await readFile(resolve(PART_ROOT, `${part}.stl`), 'utf8'), part);
  const raw = {
    torso: transformPart(await file(PARTS.torso), PLACEMENT.torso),
    head: transformPart(await file(PARTS.head), PLACEMENT.head),
    hair: transformPart(await file(PARTS.hair), PLACEMENT.hair),
    bandana: transformPart(await file(PARTS.bandana), PLACEMENT.bandana),
    hips: transformPart(await file(PARTS.hips), PLACEMENT.hips),
    leftLeg: transformPart(await file(PARTS.screenLeftLeg), PLACEMENT.screenLeftLeg),
    rightLeg: transformPart(await file(PARTS.screenRightLeg), PLACEMENT.screenRightLeg),
    leftArm: transformPart(await file(PARTS.screenLeftArm), PLACEMENT.screenLeftArm, ROT_SCREEN_LEFT_ARM),
    rightArm: transformPart(await file(PARTS.screenRightArm), PLACEMENT.screenRightArm, ROT_SCREEN_RIGHT_ARM),
    leftHand: transformPart(await file(PARTS.hand), PLACEMENT.screenLeftHand, ROT_SCREEN_LEFT_HAND),
    rightHand: transformPart(await file(PARTS.hand), PLACEMENT.screenRightHand, ROT_SCREEN_RIGHT_HAND)
  };
  return normalizeParts(raw);
}

async function generate() {
  const exact = await loadParts();
  const materials = [
    ['TournamentGreen',0x149447,0.01,.23],
    ['DeepGreen',0x075a2d,0.01,.28],
    ['SkinYellow',0xf2cd37,0,.21],
    ['Black',0x111315,.02,.26],
    ['WarmGold',0xc89b3c,.34,.22],
    ['Olive',0x50652a,.01,.30],
    ['TanHair',0xd6b36a,.01,.24],
    ['White',0xf5f5ef,0,.24],
    ['DarkGray',0x33373c,.02,.27]
  ].map(([name,color,metallic,roughness])=>({name,pbrMetallicRoughness:{baseColorFactor:rgb(color),metallicFactor:metallic,roughnessFactor:roughness}}));

  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[]; let byteLength=0;
  const push=(typed,target)=>{const src=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength),padded=new Uint8Array(pad4(src.byteLength));padded.set(src);const off=byteLength;chunks.push(padded);byteLength+=padded.byteLength;bufferViews.push({buffer:0,byteOffset:off,byteLength:src.byteLength,target});return bufferViews.length-1;};
  const mm=v=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<v.length;k+=3)for(let a=0;a<3;a++){min[a]=Math.min(min[a],v[k+a]);max[a]=Math.max(max[a],v[k+a]);}return{min,max};};
  const acc=(typed,type,componentType,target,min,max)=>{const bufferView=push(typed,target),count=typed.length/(type==='VEC3'?3:1),a={bufferView,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessors.length-1;};
  const mesh=(name,p,i,material)=>{const pos=new Float32Array(p),maxIndex=Math.max(...i),Idx=maxIndex>65535?Uint32Array:Uint16Array,componentType=maxIndex>65535?5125:5123,idx=new Idx(i),bounds=mm(pos),pa=acc(pos,'VEC3',5126,34962,bounds.min,bounds.max),na=acc(normals(pos,idx),'VEC3',5126,34962),ia=acc(idx,'SCALAR',componentType,34963,[0],[maxIndex]);meshes.push({name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material}]});return meshes.length-1;};
  const triangleMesh=(name,p,material)=>mesh(name,p,Array.from({length:p.length/3},(_,i)=>i),material);
  const node=(name,meshIndex,t=[0,0,0],s=[1,1,1],r,children,extras)=>{const n={name,translation:t,scale:s};if(meshIndex!==null)n.mesh=meshIndex;if(r)n.rotation=r;if(children?.length)n.children=children;if(extras)n.extras=extras;nodes.push(n);return nodes.length-1;};

  const [bp,bi]=box(),[cp,ci]=cylinder(),[sp,si]=sphere(),[tp,ti]=torus();
  const M = {
    greenBox:mesh('GreenBox',bp,bi,0), deepBox:mesh('DeepGreenBox',bp,bi,1), yellowBox:mesh('YellowBox',bp,bi,2), blackBox:mesh('BlackBox',bp,bi,3), goldBox:mesh('GoldBox',bp,bi,4), oliveBox:mesh('OliveBox',bp,bi,5), grayBox:mesh('DarkGrayBox',bp,bi,8),
    blackCyl:mesh('BlackCylinder',cp,ci,3), goldCyl:mesh('GoldCylinder',cp,ci,4),
    blackSphere:mesh('BlackSphere',sp,si,3), whiteSphere:mesh('WhiteSphere',sp,si,7),
    goldTorus:mesh('GoldTorus',tp,ti,4)
  };

  const exactMeshes = {
    torso: triangleMesh('ExactTorso973', subtractPivot(exact.parts.torso,RIG_PIVOTS.torso),0),
    head: triangleMesh('ExactHead3626b', subtractPivot(exact.parts.head,RIG_PIVOTS.head),2),
    hair: triangleMesh('ExactHair61183', subtractPivot(exact.parts.hair,RIG_PIVOTS.head),6),
    bandana: triangleMesh('ExactBandana15619', subtractPivot(exact.parts.bandana,RIG_PIVOTS.head),0),
    hips: triangleMesh('ExactHips3815', exact.parts.hips,0),
    leftLeg: triangleMesh('ExactScreenLeftLeg3816', subtractPivot(exact.parts.leftLeg,RIG_PIVOTS.leftLeg),0),
    rightLeg: triangleMesh('ExactScreenRightLeg3817', subtractPivot(exact.parts.rightLeg,RIG_PIVOTS.rightLeg),0),
    leftArm: triangleMesh('ExactScreenLeftArm3818', subtractPivot(exact.parts.leftArm,RIG_PIVOTS.leftArm),2),
    rightArm: triangleMesh('ExactScreenRightArm3819', subtractPivot(exact.parts.rightArm,RIG_PIVOTS.rightArm),2),
    leftHand: triangleMesh('ExactScreenLeftHand3820', subtractPivot(exact.parts.leftHand,RIG_PIVOTS.leftArm),3),
    rightHand: triangleMesh('ExactScreenRightHand3820', subtractPivot(exact.parts.rightHand,RIG_PIVOTS.rightArm),3)
  };

  const rel=(world,pivot)=>[world[0]-pivot[0],world[1]-pivot[1],world[2]-pivot[2]];
  const torsoKids=[node('torsoMould973',exactMeshes.torso)];
  const addTorsoBox=(name,world,scale,mat,rot=0)=>torsoKids.push(node(name,mat,rel(world,RIG_PIVOTS.torso),scale,qEuler(0,0,rot)));

  // Tournament Robe: broad black diagonal sash with thin gold edging.
  addTorsoBox('tournamentSash',[-.005,1.48,.245],[.18,.82,.022],M.blackBox,-.57);
  addTorsoBox('tournamentSashGoldEdgeL',[-.105,1.48,.258],[.025,.82,.012],M.goldBox,-.57);
  addTorsoBox('tournamentSashGoldEdgeR',[.095,1.48,.258],[.022,.82,.012],M.goldBox,-.57);

  // Collar and robe seam visible beside the sash.
  addTorsoBox('collarBlackLeft',[-.14,1.73,.258],[.085,.34,.016],M.blackBox,-.48);
  addTorsoBox('collarOliveRight',[.14,1.72,.260],[.06,.31,.016],M.oliveBox,.48);
  addTorsoBox('robeChestLine',[.23,1.56,.262],[.25,.035,.016],M.grayBox,-.08);
  addTorsoBox('robeChestGoldLine',[.23,1.61,.265],[.22,.018,.014],M.goldBox,-.08);

  // Waist print / knot lines from the physical Tournament robe.
  addTorsoBox('waistBlackBand',[0,1.02,.258],[.78,.055,.018],M.blackBox,0);
  addTorsoBox('waistOliveBand',[0,.965,.261],[.74,.025,.017],M.oliveBox,0);
  addTorsoBox('waistTieDiagonal',[.18,.94,.264],[.30,.04,.017],M.blackBox,-.23);

  // Lloyd power medallion on upper screen-left chest.
  torsoKids.push(node('powerMedallionDisk',M.blackCyl,rel([-.255,1.69,.275],RIG_PIVOTS.torso),[.115,.028,.115],qEuler(Math.PI/2,0,0)));
  torsoKids.push(node('powerMedallionRing',M.goldTorus,rel([-.255,1.69,.290],RIG_PIVOTS.torso),[.145,.036,.145],qEuler(Math.PI/2,0,0)));
  const emblemMarks=[
    [[-.29,1.72,.304],[.08,.018,.012],-.55],
    [[-.255,1.68,.305],[.09,.016,.012],.28],
    [[-.225,1.72,.305],[.07,.016,.012],.72]
  ];
  for(let i=0;i<emblemMarks.length;i++){const [w,s,r]=emblemMarks[i];torsoKids.push(node(`powerGlyph${i}`,M.goldBox,rel(w,RIG_PIVOTS.torso),s,qEuler(0,0,r)));}

  // Gold pseudo-logograms along the black sash, shaped from the reference without texture copying.
  const glyphs=[
    [[.20,1.82,.326],[.075,.016,.012],.16], [[.145,1.78,.327],[.018,.07,.012],0],
    [[.075,1.64,.327],[.07,.016,.012],-.12], [[.035,1.61,.327],[.018,.06,.012],0],
    [[-.07,1.48,.327],[.08,.016,.012],.18], [[-.115,1.44,.327],[.018,.07,.012],0],
    [[-.21,1.28,.327],[.075,.016,.012],-.14], [[-.25,1.24,.327],[.018,.065,.012],0]
  ];
  glyphs.forEach(([w,s,r],i)=>torsoKids.push(node(`sashGlyph${i}`,M.goldBox,rel(w,RIG_PIVOTS.torso),s,qEuler(0,0,r))));

  const torso=node('torso',null,RIG_PIVOTS.torso,[1,1,1],undefined,torsoKids,{sourcePart:'973.dat'});

  const headKids=[
    node('headMould3626b',exactMeshes.head),
    node('hairMould61183',exactMeshes.hair),
    node('bandanaMould15619',exactMeshes.bandana)
  ];
  // Angry Tournament eyes / brows visible above the bandana.
  for(const side of[-1,1]){
    const x=side*.125;
    headKids.push(node(side<0?'leftEye':'rightEye',M.blackSphere,rel([x,2.145,.316],RIG_PIVOTS.head),[.042,.035,.018]));
    headKids.push(node(side<0?'leftEyeGlint':'rightEyeGlint',M.whiteSphere,rel([x-side*.011,2.158,.327],RIG_PIVOTS.head),[.010,.010,.006]));
    headKids.push(node(side<0?'leftBrow':'rightBrow',M.blackBox,rel([x,2.215,.318],RIG_PIVOTS.head),[.13,.025,.014],qEuler(0,0,side<0?.16:-.16)));
  }
  // Subtle dark green creases enhance the exact bandana mould without changing its silhouette.
  headKids.push(node('bandanaFoldUpper',M.deepBox,rel([0,2.045,.323],RIG_PIVOTS.head),[.42,.022,.012],qEuler(0,0,-.03)));
  headKids.push(node('bandanaFoldLower',M.deepBox,rel([-.02,1.985,.326],RIG_PIVOTS.head),[.34,.018,.011],qEuler(0,0,.05)));
  const head=node('head',null,RIG_PIVOTS.head,[1,1,1],undefined,headKids,{sourceParts:['3626b.dat','61183.dat','15619.dat']});

  const leftArmKids=[node('leftArmMould3818',exactMeshes.leftArm),node('leftHandMould3820',exactMeshes.leftHand)];
  const rightArmKids=[node('rightArmMould3819',exactMeshes.rightArm),node('rightHandMould3820',exactMeshes.rightHand)];
  const leftArm=node('leftArm',null,RIG_PIVOTS.leftArm,[1,1,1],undefined,leftArmKids,{bareYellowArm:true,blackHand:true});
  const rightArm=node('rightArm',null,RIG_PIVOTS.rightArm,[1,1,1],undefined,rightArmKids,{bareYellowArm:true,blackHand:true});

  const leftLegKids=[node('leftLegMould3816',exactMeshes.leftLeg)];
  const rightLegKids=[node('rightLegMould3817',exactMeshes.rightLeg)];
  const addLegPrint=(kids,pivot,prefix,x,mirror=1)=>{
    kids.push(node(`${prefix}KneeStripe`,M.blackBox,rel([x,.56,.222],pivot),[.25,.045,.014]));
    kids.push(node(`${prefix}KneeOlive`,M.oliveBox,rel([x,.63,.224],pivot),[.24,.024,.014]));
    kids.push(node(`${prefix}ShinStripe`,M.blackBox,rel([x,.34,.223],pivot),[.24,.038,.014]));
    kids.push(node(`${prefix}RobeFoldA`,M.blackBox,rel([x+mirror*.045,.81,.226],pivot),[.045,.28,.014],qEuler(0,0,mirror*.34)));
    kids.push(node(`${prefix}RobeFoldB`,M.oliveBox,rel([x-mirror*.045,.82,.227],pivot),[.038,.24,.014],qEuler(0,0,-mirror*.42)));
  };
  addLegPrint(leftLegKids,RIG_PIVOTS.leftLeg,'left',-.23,-1);
  addLegPrint(rightLegKids,RIG_PIVOTS.rightLeg,'right',.23,1);
  const leftLeg=node('leftLeg',null,RIG_PIVOTS.leftLeg,[1,1,1],undefined,leftLegKids,{sourcePart:'3816.dat'});
  const rightLeg=node('rightLeg',null,RIG_PIVOTS.rightLeg,[1,1,1],undefined,rightLegKids,{sourcePart:'3817.dat'});

  // Exact hip mould stays static between articulated torso and legs.
  const hips=node('hipsExact3815',exactMeshes.hips,[0,0,0],[1,1,1],undefined,undefined,{sourcePart:'3815.dat'});

  const roots=[torso,head,leftArm,rightArm,leftLeg,rightLeg,hips];
  const bin=new Uint8Array(byteLength);let cur=0;for(const c of chunks){bin.set(c,cur);cur+=c.byteLength;}
  const gltf={
    asset:{version:'2.0',generator:'Ninjago Tournament exact-mould Lloyd generator',extras:{
      character:'Lloyd (Tournament Robe)',reference:'njo0123',
      geometrySource:'LDraw-derived STL geometry vendored under third_party/ldraw-stl',
      license:'CC BY 4.0 / applicable LDraw contributor license; see third_party/ldraw-stl/LICENSE and ATTRIBUTION.md'
    }},
    scene:0,scenes:[{name:`Fighter_${ID}`,nodes:roots}],nodes,meshes,materials,
    buffers:[{byteLength:bin.byteLength}],bufferViews,accessors
  };
  let json=enc.encode(JSON.stringify(gltf));const jp=pad4(json.byteLength),jc=new Uint8Array(jp);jc.fill(0x20);jc.set(json);const bpadded=pad4(bin.byteLength),bc=new Uint8Array(bpadded);bc.set(bin);const total=12+8+jc.byteLength+8+bc.byteLength,out=new ArrayBuffer(total),view=new DataView(out),bytes=new Uint8Array(out);let o=0;
  view.setUint32(o,0x46546c67,true);o+=4;view.setUint32(o,2,true);o+=4;view.setUint32(o,total,true);o+=4;view.setUint32(o,jc.byteLength,true);o+=4;view.setUint32(o,0x4e4f534a,true);o+=4;bytes.set(jc,o);o+=jc.byteLength;view.setUint32(o,bc.byteLength,true);o+=4;view.setUint32(o,0x004e4942,true);o+=4;bytes.set(bc,o);
  await mkdir(dirname(OUTPUT),{recursive:true});
  await writeFile(OUTPUT,new Uint8Array(out));
  const required=['torso','head','leftArm','rightArm','leftLeg','rightLeg'];
  console.log(JSON.stringify({
    output:OUTPUT,bytes:total,nodes:nodes.length,meshes:meshes.length,materials:materials.length,
    exactMoulds:Object.values(PARTS),required:required.every(n=>nodes.some(x=>x.name===n)),
    sourceScale:exact.scale
  },null,2));
}

await generate();

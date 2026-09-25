import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const enc = new TextEncoder();
const pad4 = (n) => (n + 3) & ~3;
const SCALE = 0.058; // millimetres -> game units; exact mould assembly is ~2.55 units tall.
const mm = (ldu) => ldu * 0.4;
const rgb = (n) => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];

function box() {
  return [
    [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5, -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
    [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]
  ];
}
function cylinder(seg = 24) {
  const p = [], i = [];
  for (const y of [-.5, .5]) {
    for (let s = 0; s < seg; s++) {
      const a = Math.PI * 2 * s / seg;
      p.push(Math.cos(a), y, Math.sin(a));
    }
  }
  p.push(0,-.5,0, 0,.5,0);
  const bottom = seg * 2, top = bottom + 1;
  for (let s = 0; s < seg; s++) {
    const n = (s + 1) % seg;
    i.push(s,n,seg+n, s,seg+n,seg+s, bottom,n,s, top,seg+s,seg+n);
  }
  return [p, i];
}
function normals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k+1] * 3, c = idx[k+2] * 3;
    const ab = [pos[b]-pos[a], pos[b+1]-pos[a+1], pos[b+2]-pos[a+2]];
    const ac = [pos[c]-pos[a], pos[c+1]-pos[a+1], pos[c+2]-pos[a+2]];
    const nn = [
      ab[1]*ac[2] - ab[2]*ac[1],
      ab[2]*ac[0] - ab[0]*ac[2],
      ab[0]*ac[1] - ab[1]*ac[0]
    ];
    for (const o of [a,b,c]) {
      n[o] += nn[0]; n[o+1] += nn[1]; n[o+2] += nn[2];
    }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k+1], n[k+2]) || 1;
    n[k] /= l; n[k+1] /= l; n[k+2] /= l;
  }
  return n;
}
function qEuler(x = 0, y = 0, z = 0) {
  const cx=Math.cos(x/2), sx=Math.sin(x/2), cy=Math.cos(y/2), sy=Math.sin(y/2), cz=Math.cos(z/2), sz=Math.sin(z/2);
  return [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz, cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz];
}
function applyMat3(m, [x,y,z]) {
  return [
    m[0]*x + m[1]*y + m[2]*z,
    m[3]*x + m[4]*y + m[5]*z,
    m[6]*x + m[7]*y + m[8]*z
  ];
}
function toWorldMm([x,y,z]) {
  // LDraw/STL uses +Y down; game/Three uses +Y up. +Z is the minifigure front.
  return [x * SCALE, -y * SCALE, z * SCALE];
}
async function readAsciiStl(part) {
  const text = await readFile(resolve(\`third_party/ldraw-stl/\${part}.stl\`), 'utf8');
  const positions = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('vertex ')) continue;
    const values = line.slice(7).trim().split(/\s+/).map(Number);
    if (values.length === 3 && values.every(Number.isFinite)) positions.push(...values);
  }
  if (positions.length < 9 || positions.length % 9 !== 0) {
    throw new Error(\`Invalid ASCII STL for LDraw mould \${part}: \${positions.length / 3} vertices\`);
  }
  const indices = Array.from({ length: positions.length / 3 }, (_, index) => index);
  return [positions, indices];
}
function transformExactPositions(source, translationMm, rotation, rigOrigin) {
  const out = [];
  for (let k = 0; k < source.length; k += 3) {
    const local = applyMat3(rotation, [source[k], source[k+1], source[k+2]]);
    const placed = [
      local[0] + translationMm[0],
      local[1] + translationMm[1],
      local[2] + translationMm[2]
    ];
    const world = toWorldMm(placed);
    out.push(world[0]-rigOrigin[0], world[1]-rigOrigin[1], world[2]-rigOrigin[2]);
  }
  return out;
}

const I = [1,0,0, 0,1,0, 0,0,1];
const ROT_LEFT_ARM = [
  .9855,-.1699,0,
  .1699,.9855,0,
  0,0,1
];
const ROT_RIGHT_ARM = [
  .9855,.1699,0,
  -.1699,.9855,0,
  0,0,1
];
const ROT_LEFT_HAND = [
  .942,.335,.0072,
  -.2404,.6906,-.6821,
  -.2336,.6409,.7312
];
const ROT_RIGHT_HAND = [
  .942,-.335,.0072,
  .2404,.6906,-.6821,
  .2336,.6409,.7312
];

async function generate() {
  const id = 'lloyd-tournament';
  const materials = [
    ['TournamentGreen', 0x08783b, .01, .24],
    ['SkinYellow', 0xf4c430, 0, .22],
    ['Black', 0x101112, .01, .28],
    ['TanHair', 0xd4ad67, .01, .25],
    ['WarmGold', 0xb89135, .28, .22],
    ['Olive', 0x6d7136, .01, .30],
    ['White', 0xf5f5ef, 0, .30],
    ['DarkGreen', 0x054b28, .01, .30]
  ].map(([name,color,metallic,roughness]) => ({
    name,
    pbrMetallicRoughness: {
      baseColorFactor: rgb(color),
      metallicFactor: metallic,
      roughnessFactor: roughness
    }
  }));

  const chunks=[], bufferViews=[], accessors=[], meshes=[], nodes=[];
  let byteLength=0;
  const push=(typed,target)=>{
    const src=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength);
    const padded=new Uint8Array(pad4(src.byteLength));
    padded.set(src);
    const off=byteLength;
    chunks.push(padded);
    byteLength+=padded.byteLength;
    bufferViews.push({buffer:0,byteOffset:off,byteLength:src.byteLength,target});
    return bufferViews.length-1;
  };
  const bounds=(v)=>{
    const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
    for(let k=0;k<v.length;k+=3) for(let a=0;a<3;a++){
      min[a]=Math.min(min[a],v[k+a]);
      max[a]=Math.max(max[a],v[k+a]);
    }
    return {min,max};
  };
  const accessor=(typed,type,componentType,target,min,max)=>{
    const bufferView=push(typed,target);
    const count=typed.length/(type==='VEC3'?3:1);
    const out={bufferView,componentType,count,type};
    if(min) out.min=min;
    if(max) out.max=max;
    accessors.push(out);
    return accessors.length-1;
  };
  const mesh=(name,p,i,material)=>{
    const pos=new Float32Array(p);
    const indexArray = p.length / 3 > 65535 ? new Uint32Array(i) : new Uint16Array(i);
    const componentType = indexArray instanceof Uint32Array ? 5125 : 5123;
    const b=bounds(pos);
    const pa=accessor(pos,'VEC3',5126,34962,b.min,b.max);
    const na=accessor(normals(pos,indexArray),'VEC3',5126,34962);
    const ia=accessor(indexArray,'SCALAR',componentType,34963,[0],[Math.max(...i)]);
    meshes.push({name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material}]});
    return meshes.length-1;
  };
  const node=(name,meshIndex,t=[0,0,0],s=[1,1,1],r,children)=>{
    const out={name,translation:t,scale:s};
    if(meshIndex!==null) out.mesh=meshIndex;
    if(r) out.rotation=r;
    if(children?.length) out.children=children;
    nodes.push(out);
    return nodes.length-1;
  };

  const [bp,bi]=box(), [cp,ci]=cylinder();
  const unit = {
    greenBox: mesh('TournamentGreenBox',bp,bi,0),
    yellowBox: mesh('SkinYellowBox',bp,bi,1),
    blackBox: mesh('BlackBox',bp,bi,2),
    goldBox: mesh('WarmGoldBox',bp,bi,4),
    oliveBox: mesh('OliveBox',bp,bi,5),
    whiteBox: mesh('WhiteBox',bp,bi,6),
    darkGreenBox: mesh('DarkGreenBox',bp,bi,7),
    blackCylinder: mesh('BlackCylinder',cp,ci,2),
    goldCylinder: mesh('WarmGoldCylinder',cp,ci,4),
    oliveCylinder: mesh('OliveCylinder',cp,ci,5)
  };

  // Animation pivots match the existing gameplay rig while exact mould geometry
  // is transformed into each pivot's local space.
  const torsoOrigin=[0,1.43,0];
  const headOrigin=[0,2.08,0];
  const leftArmOrigin=toWorldMm([mm(-15.552),mm(-63),0]);
  const rightArmOrigin=toWorldMm([mm(15.552),mm(-63),0]);
  const leftLegOrigin=[mm(-10.5)*SCALE, mm(37)*SCALE, 0];
  const rightLegOrigin=[mm(10.5)*SCALE, mm(37)*SCALE, 0];

  async function exactNode(name, part, material, translationMm, rotation, rigOrigin) {
    const [raw,idx]=await readAsciiStl(part);
    const transformed=transformExactPositions(raw,translationMm,rotation,rigOrigin);
    return node(name,mesh(\`\${name}Mesh\`,transformed,idx,material));
  }

  // Exact torso + hips under one torso animation pivot.
  const torsoKids=[];
  torsoKids.push(await exactNode('torsoMould973','973',0,[0,mm(-72),0],I,torsoOrigin));
  torsoKids.push(await exactNode('hipsExact3815','3815',0,[0,mm(-40),0],I,torsoOrigin));

  // Tournament robe print: black diagonal sash, gold pseudo-logograms,
  // power medallion, collar and belt. Geometry is clean-room; no texture bitmap
  // from a commercial asset is copied into the repository.
  const frontZ=.245;
  torsoKids.push(node('tournamentSash',unit.blackBox,[.055,.03,frontZ],[.19,.93,.032],qEuler(0,0,-.56)));
  torsoKids.push(node('tournamentSashGoldEdgeA',unit.goldBox,[-.035,.03,frontZ+.022],[.025,.93,.018],qEuler(0,0,-.56)));
  torsoKids.push(node('tournamentSashGoldEdgeB',unit.goldBox,[.143,.03,frontZ+.023],[.020,.89,.018],qEuler(0,0,-.56)));

  const glyphs=[
    [-.01,.30,.10,.035,-.18], [.05,.15,.12,.035,.28],
    [.11,-.01,.09,.035,-.34], [.17,-.17,.11,.035,.15]
  ];
  glyphs.forEach((g,index)=>{
    torsoKids.push(node(\`sashGlyph\${index}\`,unit.goldBox,[g[0],g[1],frontZ+.045],[g[2],g[3],.018],qEuler(0,0,g[4])));
  });

  // Lloyd power emblem: layered circular badge on viewer-left chest.
  torsoKids.push(node('powerMedallionDisk',unit.blackCylinder,[-.235,.255,frontZ+.045],[.135,.026,.135],qEuler(Math.PI/2,0,0)));
  torsoKids.push(node('powerMedallionRing',unit.goldCylinder,[-.235,.255,frontZ+.064],[.105,.027,.105],qEuler(Math.PI/2,0,0)));
  torsoKids.push(node('powerMedallionCore',unit.blackCylinder,[-.235,.255,frontZ+.083],[.073,.028,.073],qEuler(Math.PI/2,0,0)));
  torsoKids.push(node('powerGlyphStem',unit.goldBox,[-.235,.255,frontZ+.105],[.025,.10,.018],qEuler(0,0,.18)));
  torsoKids.push(node('powerGlyphWingL',unit.goldBox,[-.265,.268,frontZ+.106],[.065,.022,.018],qEuler(0,0,-.52)));
  torsoKids.push(node('powerGlyphWingR',unit.goldBox,[-.205,.268,frontZ+.106],[.065,.022,.018],qEuler(0,0,.52)));

  // Collar and waist print visible around/under the diagonal sash.
  torsoKids.push(node('collarBlackL',unit.blackBox,[-.13,.34,frontZ+.02],[.07,.34,.020],qEuler(0,0,-.55)));
  torsoKids.push(node('collarOliveL',unit.oliveBox,[-.185,.34,frontZ+.04],[.028,.31,.018],qEuler(0,0,-.55)));
  torsoKids.push(node('collarBlackR',unit.blackBox,[.13,.34,frontZ+.02],[.07,.34,.020],qEuler(0,0,.55)));
  torsoKids.push(node('collarOliveR',unit.oliveBox,[.185,.34,frontZ+.04],[.028,.31,.018],qEuler(0,0,.55)));
  torsoKids.push(node('waistBlackBand',unit.blackBox,[0,-.38,frontZ+.025],[.79,.07,.022]));
  torsoKids.push(node('waistOliveBand',unit.oliveBox,[0,-.325,frontZ+.046],[.79,.025,.018]));
  torsoKids.push(node('waistGoldKnot',unit.goldBox,[.18,-.39,frontZ+.052],[.16,.06,.02],qEuler(0,0,.15)));

  // Back emblem visible in rear reference photos.
  torsoKids.push(node('backEmblemOuter',unit.blackCylinder,[0,.08,-.245],[.205,.025,.205],qEuler(Math.PI/2,0,0)));
  torsoKids.push(node('backEmblemRing',unit.oliveCylinder,[0,.08,-.267],[.165,.026,.165],qEuler(Math.PI/2,0,0)));
  torsoKids.push(node('backEmblemCore',unit.blackCylinder,[0,.08,-.289],[.11,.027,.11],qEuler(Math.PI/2,0,0)));

  const torso=node('torso',null,torsoOrigin,[1,1,1],undefined,torsoKids);

  // Exact head, swept-back hair and lower-face ninja bandana.
  const headKids=[];
  headKids.push(await exactNode('headMould3626b','3626b',1,[0,mm(-100),0],I,headOrigin));
  headKids.push(await exactNode('hairMould61183','61183',3,[0,mm(-100),0],I,headOrigin));
  // 15619 sits lower than head/hair attachment origin so it covers mouth and chin.
  headKids.push(await exactNode('bandanaMould15619','15619',0,[0,mm(-84),0],I,headOrigin));

  // Angry Tournament face: black eyes/brows, tiny white highlights. Mouth is
  // intentionally omitted because the physical 15619 bandana covers it.
  for(const side of [-1,1]){
    const x=side*.115;
    headKids.push(node(side<0?'leftEye':'rightEye',unit.blackBox,[x,.085,.306],[.072,.050,.018]));
    headKids.push(node(side<0?'leftEyeGlint':'rightEyeGlint',unit.whiteBox,[x-side*.018,.098,.318],[.014,.014,.010]));
    headKids.push(node(side<0?'leftBrow':'rightBrow',unit.blackBox,[x,.155,.310],[.135,.026,.016],qEuler(0,0,side<0?.18:-.18)));
  }
  const head=node('head',null,headOrigin,[1,1,1],undefined,headKids);

  // Exact bare yellow arms + black minifigure hands.
  const leftArmKids=[];
  leftArmKids.push(await exactNode('leftArmMould3818','3818',1,[mm(-15.552),mm(-63),0],ROT_LEFT_ARM,leftArmOrigin));
  leftArmKids.push(await exactNode('leftHandMould3820','3820',2,[mm(-23.552),mm(-46),mm(-10)],ROT_LEFT_HAND,leftArmOrigin));
  const leftArm=node('leftArm',null,leftArmOrigin,[1,1,1],undefined,leftArmKids);

  const rightArmKids=[];
  rightArmKids.push(await exactNode('rightArmMould3819','3819',1,[mm(15.552),mm(-63),0],ROT_RIGHT_ARM,rightArmOrigin));
  rightArmKids.push(await exactNode('rightHandMould3820','3820',2,[mm(23.552),mm(-46),mm(-10)],ROT_RIGHT_HAND,rightArmOrigin));
  const rightArm=node('rightArm',null,rightArmOrigin,[1,1,1],undefined,rightArmKids);

  // Exact legs with the black knee stripes and olive/black robe continuation.
  const leftLegKids=[];
  leftLegKids.push(await exactNode('leftLegMould3816','3816',0,[0,mm(-28),0],I,leftLegOrigin));
  leftLegKids.push(node('leftKneeStripeA',unit.blackBox,[0,-.29,.218],[.33,.035,.018]));
  leftLegKids.push(node('leftKneeStripeB',unit.blackBox,[0,-.39,.219],[.33,.035,.018]));
  leftLegKids.push(node('leftUpperBlackPanel',unit.blackBox,[.03,.10,.218],[.28,.30,.018],qEuler(0,0,-.06)));
  const leftLeg=node('leftLeg',null,leftLegOrigin,[1,1,1],undefined,leftLegKids);

  const rightLegKids=[];
  rightLegKids.push(await exactNode('rightLegMould3817','3817',0,[0,mm(-28),0],I,rightLegOrigin));
  rightLegKids.push(node('rightKneeStripeA',unit.blackBox,[0,-.29,.218],[.33,.035,.018]));
  rightLegKids.push(node('rightKneeStripeB',unit.blackBox,[0,-.39,.219],[.33,.035,.018]));
  rightLegKids.push(node('rightOliveRobe',unit.oliveBox,[-.03,.10,.219],[.25,.34,.018],qEuler(0,0,.20)));
  rightLegKids.push(node('rightRobeBlackEdge',unit.blackBox,[.07,.11,.240],[.035,.35,.014],qEuler(0,0,.20)));
  const rightLeg=node('rightLeg',null,rightLegOrigin,[1,1,1],undefined,rightLegKids);

  const roots=[torso,head,leftArm,rightArm,leftLeg,rightLeg];

  const bin=new Uint8Array(byteLength);
  let cursor=0;
  for(const chunk of chunks){bin.set(chunk,cursor);cursor+=chunk.byteLength;}

  const gltf={
    asset:{
      version:'2.0',
      generator:'Ninjago Tournament exact-mould Lloyd generator (LDraw-derived geometry; see third_party/ldraw-stl/LICENSE)'
    },
    scene:0,
    scenes:[{name:\`Fighter_\${id}\`,nodes:roots}],
    nodes,meshes,materials,
    buffers:[{byteLength:bin.byteLength}],
    bufferViews,accessors
  };

  let json=enc.encode(JSON.stringify(gltf));
  const jsonPadded=new Uint8Array(pad4(json.byteLength));
  jsonPadded.fill(0x20);
  jsonPadded.set(json);
  const binaryPadded=new Uint8Array(pad4(bin.byteLength));
  binaryPadded.set(bin);
  const total=12+8+jsonPadded.byteLength+8+binaryPadded.byteLength;
  const out=new ArrayBuffer(total), view=new DataView(out), bytes=new Uint8Array(out);
  let o=0;
  view.setUint32(o,0x46546c67,true);o+=4;
  view.setUint32(o,2,true);o+=4;
  view.setUint32(o,total,true);o+=4;
  view.setUint32(o,jsonPadded.byteLength,true);o+=4;
  view.setUint32(o,0x4e4f534a,true);o+=4;
  bytes.set(jsonPadded,o);o+=jsonPadded.byteLength;
  view.setUint32(o,binaryPadded.byteLength,true);o+=4;
  view.setUint32(o,0x004e4942,true);o+=4;
  bytes.set(binaryPadded,o);

  const output=resolve('public/assets/models/fighters/lloyd-tournament.glb');
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,new Uint8Array(out));

  const required=['torso','head','leftArm','rightArm','leftLeg','rightLeg'];
  console.log(JSON.stringify({
    output,
    bytes:total,
    nodes:nodes.length,
    meshes:meshes.length,
    materials:materials.length,
    exactMoulds:['973','3626b','61183','15619','3815','3816','3817','3818','3819','3820'],
    required:required.every(name=>nodes.some(candidate=>candidate.name===name))
  },null,2));
}
await generate();

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const enc = new TextEncoder();
const pad4 = n => (n + 3) & ~3;
const rgb = n => [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255, 1];

function box(){
  return [[-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5, -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
    [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3]];
}
function cylinder(seg=16){
  const p=[],i=[];
  for(const y of[-.5,.5]) for(let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),y,Math.sin(a));}
  p.push(0,-.5,0,0,.5,0); const b=seg*2,t=b+1;
  for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,seg+n,s,seg+n,seg+s,b,n,s,t,seg+s,seg+n);}
  return [p,i];
}
function sphere(lat=6,lon=12){
  const p=[],i=[];
  for(let y=0;y<=lat;y++){const v=y/lat,phi=v*Math.PI;for(let x=0;x<=lon;x++){const u=x/lon,th=u*Math.PI*2;p.push(Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));}}
  for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;i.push(a,b,a+1,b,b+1,a+1);}
  return [p,i];
}
function cone(seg=12){
  const p=[],i=[];
  for(let s=0;s<seg;s++){const a=2*Math.PI*s/seg;p.push(Math.cos(a),-.5,Math.sin(a));}
  p.push(0,.5,0, 0,-.5,0); const tip=seg,base=seg+1;
  for(let s=0;s<seg;s++){const n=(s+1)%seg;i.push(s,n,tip,base,n,s);}
  return [p,i];
}
function torus(segU=16,segV=6,arc=Math.PI*2){
  const p=[],i=[]; const R=.7,r=.3;
  for(let u=0;u<=segU;u++){
    const a=arc*u/segU;
    for(let v=0;v<=segV;v++){
      const b=2*Math.PI*v/segV; const rr=R+r*Math.cos(b);
      p.push(rr*Math.cos(a), r*Math.sin(b), rr*Math.sin(a));
    }
  }
  for(let u=0;u<segU;u++) for(let v=0;v<segV;v++){
    const a=u*(segV+1)+v,b=a+segV+1;i.push(a,b,a+1,b,b+1,a+1);
  }
  return [p,i];
}
function normals(pos,idx){
  const n=new Float32Array(pos.length);
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

async function generate(){
  const id='lloyd-tournament';
  const materials=[
    ['LloydGreen',0x168c3a,.02,.3], ['DeepGreen',0x075a2d,.02,.34], ['Gold',0xd8b64c,.6,.2],
    ['Black',0x101314,.04,.38], ['SkinYellow',0xf2c64f,0,.28], ['BlondHair',0xe8c65b,.04,.3],
    ['HairHighlight',0xffe58c,.02,.28], ['EyeGreen',0x37c46b,.02,.18], ['EyeBlack',0x050708,.0,.24],
    ['White',0xf3f6ef,0,.32], ['Steel',0xc9d0d3,.75,.16], ['EnergyGreen',0x65ff72,.15,.15]
  ].map(([name,color,metallic,roughness])=>({name,pbrMetallicRoughness:{baseColorFactor:rgb(color),metallicFactor:metallic,roughnessFactor:roughness}}));
  materials[11].emissiveFactor=[.12,1,.16];

  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[]; let byteLength=0;
  const push=(typed,target)=>{const src=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength),padded=new Uint8Array(pad4(src.byteLength));padded.set(src);const off=byteLength;chunks.push(padded);byteLength+=padded.byteLength;bufferViews.push({buffer:0,byteOffset:off,byteLength:src.byteLength,target});return bufferViews.length-1;};
  const mm=v=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<v.length;k+=3)for(let a=0;a<3;a++){min[a]=Math.min(min[a],v[k+a]);max[a]=Math.max(max[a],v[k+a]);}return{min,max};};
  const acc=(typed,type,componentType,target,min,max)=>{const bufferView=push(typed,target),count=typed.length/(type==='VEC3'?3:1),a={bufferView,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessors.length-1;};
  const mesh=(name,p,i,material)=>{const pos=new Float32Array(p),idx=new Uint16Array(i),bounds=mm(pos),pa=acc(pos,'VEC3',5126,34962,bounds.min,bounds.max),na=acc(normals(pos,idx),'VEC3',5126,34962),ia=acc(idx,'SCALAR',5123,34963,[0],[Math.max(...i)]);meshes.push({name,primitives:[{attributes:{POSITION:pa,NORMAL:na},indices:ia,material}]});return meshes.length-1;};
  const node=(name,meshIndex,t=[0,0,0],s=[1,1,1],r,children)=>{const n={name,translation:t,scale:s};if(meshIndex!==null)n.mesh=meshIndex;if(r)n.rotation=r;if(children?.length)n.children=children;nodes.push(n);return nodes.length-1;};

  const [bp,bi]=box(),[cp,ci]=cylinder(),[sp,si]=sphere(),[kp,ki]=cone(),[tp,ti]=torus(),[ctp,cti]=torus(14,5,Math.PI*1.55);
  const meshesBy={
    greenBox:mesh('GreenBox',bp,bi,0), deepBox:mesh('DeepGreenBox',bp,bi,1), goldBox:mesh('GoldBox',bp,bi,2), blackBox:mesh('BlackBox',bp,bi,3),
    skinCyl:mesh('SkinCylinder',cp,ci,4), greenCyl:mesh('GreenCylinder',cp,ci,0), deepCyl:mesh('DeepCylinder',cp,ci,1), goldCyl:mesh('GoldCylinder',cp,ci,2), blackCyl:mesh('BlackCylinder',cp,ci,3),
    skinSphere:mesh('SkinSphere',sp,si,4), hairSphere:mesh('HairSphere',sp,si,5), hairHiSphere:mesh('HairHighlightSphere',sp,si,6), eyeSphere:mesh('EyeGreenSphere',sp,si,7), blackSphere:mesh('BlackSphere',sp,si,8), whiteSphere:mesh('WhiteSphere',sp,si,9),
    goldCone:mesh('GoldCone',kp,ki,2), hairCone:mesh('HairCone',kp,ki,5), steelBox:mesh('SteelBox',bp,bi,10), energyBox:mesh('EnergyBox',bp,bi,11),
    blackTorus:mesh('BlackTorus',tp,ti,3), greenTorus:mesh('GreenTorus',tp,ti,0), skinCTorus:mesh('SkinCTorus',ctp,cti,4)
  };
  const M=meshesBy;

  // Torso rig and layered Tournament robe.
  const torsoKids=[];
  torsoKids.push(node('torsoBody',M.greenBox,[0,0,0],[.82,.9,.52]));
  torsoKids.push(node('torsoSideShadowL',M.deepBox,[-.37,-.02,.01],[.09,.82,.54]));
  torsoKids.push(node('torsoSideShadowR',M.deepBox,[.37,-.02,.01],[.09,.82,.54]));
  torsoKids.push(node('torsoUnderRobe',M.blackBox,[0,.01,.275],[.52,.63,.025]));
  torsoKids.push(node('torsoGoldSash',M.goldBox,[.01,.02,.295],[.13,.78,.027],qEuler(0,0,-.53)));
  torsoKids.push(node('torsoGreenSash',M.deepBox,[-.095,.02,.3],[.065,.76,.026],qEuler(0,0,-.53)));
  torsoKids.push(node('collarLeft',M.blackBox,[-.17,.29,.302],[.12,.42,.03],qEuler(0,0,-.54)));
  torsoKids.push(node('collarRight',M.goldBox,[.17,.29,.305],[.09,.42,.031],qEuler(0,0,.54)));
  torsoKids.push(node('waistWrapTop',M.blackBox,[0,-.35,.298],[.84,.09,.035]));
  torsoKids.push(node('waistWrapGold',M.goldBox,[0,-.42,.301],[.84,.055,.035]));
  torsoKids.push(node('beltKnot',M.blackBox,[0,-.5,.315],[.22,.13,.055]));
  torsoKids.push(node('beltMedallion',M.goldCyl,[.0,-.49,.354],[.12,.035,.12],qEuler(Math.PI/2,0,0)));
  // Abstract dragon/energy emblem relief (original geometry, no copied texture).
  const emblem=[[-.20,.17,.326,.18,.05,.035,-.38],[-.08,.11,.33,.22,.045,.035,.48],[.09,.15,.332,.23,.045,.035,-.58],[.19,.03,.334,.17,.042,.035,.35],[-.15,-.03,.334,.17,.042,.035,.58],[.05,-.10,.335,.22,.04,.035,-.22]];
  emblem.forEach((e,i)=>torsoKids.push(node(`energyEmblem${i}`,M.goldBox,[e[0],e[1],e[2]],[e[3],e[4],e[5]],qEuler(0,0,e[6]))));
  // Neck scarf/cowl layered around shoulders.
  torsoKids.push(node('neckCowlBack',M.greenTorus,[0,.43,-.03],[.5,.19,.46],qEuler(Math.PI/2,0,0)));
  torsoKids.push(node('neckCowlGoldTrim',M.greenTorus,[0,.45,.0],[.48,.08,.45],qEuler(Math.PI/2,0,0)));
  const torso=node('torso',null,[0,1.3,0],[1,1,1],undefined,torsoKids);

  // Lloyd head, expressive green eyes and signature blond hair.
  const headKids=[];
  headKids.push(node('headCore',M.skinCyl,[0,0,0],[.345,.5,.345]));
  // eyes: white -> green iris -> black pupil -> tiny white glint
  for(const side of[-1,1]){
    const x=side*.13;
    headKids.push(node(side<0?'leftEyeWhite':'rightEyeWhite',M.whiteSphere,[x,.055,.337],[.105,.052,.02]));
    headKids.push(node(side<0?'leftEyeIris':'rightEyeIris',M.eyeSphere,[x,.055,.353],[.055,.04,.013]));
    headKids.push(node(side<0?'leftEyePupil':'rightEyePupil',M.blackSphere,[x+side*.006,.055,.364],[.025,.029,.01]));
    headKids.push(node(side<0?'leftEyeGlint':'rightEyeGlint',M.whiteSphere,[x-side*.011,.071,.372],[.010,.010,.006]));
    headKids.push(node(side<0?'leftBrow':'rightBrow',M.blackBox,[x,.14,.356],[.15,.027,.018],qEuler(0,0,side<0?.13:-.13)));
  }
  headKids.push(node('mouth',M.blackBox,[.025,-.13,.354],[.17,.022,.014],qEuler(0,0,-.06)));
  headKids.push(node('mouthSmileTip',M.blackBox,[.105,-.105,.354],[.045,.018,.014],qEuler(0,0,.48)));
  // Hair cap and swooping locks.
  headKids.push(node('hairCap',M.hairSphere,[0,.31,-.02],[.39,.25,.37]));
  const locks=[
    [-.24,.31,.22,.18,.28,.13,-.54,0,.20],[ -.08,.39,.28,.20,.30,.14,-.28,0,.07],[.09,.42,.29,.22,.31,.14,.18,0,-.02],[.25,.35,.23,.18,.29,.13,.46,0,-.14],
    [-.32,.23,.10,.15,.26,.13,-.72,.10,.30],[.34,.22,.08,.15,.25,.13,.74,-.08,-.28],[-.20,.48,.03,.16,.25,.15,-.35,.12,.18],[.19,.49,.02,.16,.25,.15,.34,-.1,-.18],
    [-.36,.12,-.03,.12,.23,.12,-.85,.12,.28],[.36,.11,-.04,.12,.23,.12,.84,-.12,-.28],[-.08,.50,-.15,.13,.22,.14,-.12,.15,.05],[.10,.50,-.16,.13,.22,.14,.12,-.15,-.05]
  ];
  locks.forEach((v,i)=>headKids.push(node(`hairLock${i}`,i%3===1?M.hairHiSphere:M.hairSphere,[v[0],v[1],v[2]],[v[3],v[4],v[5]],qEuler(v[7],v[8],v[6]))));
  // front fringe points
  headKids.push(node('fringeLeft',M.hairCone,[-.16,.24,.31],[.13,.24,.11],qEuler(0,0,.28)));
  headKids.push(node('fringeCenter',M.hairCone,[.02,.29,.34],[.14,.27,.11],qEuler(0,0,-.08)));
  headKids.push(node('fringeRight',M.hairCone,[.18,.25,.30],[.12,.23,.10],qEuler(0,0,-.30)));
  const head=node('head',null,[0,2.02,0],[1,1,1],undefined,headKids);

  const roots=[torso,head];
  // Arms with green sleeves, gold wraps, LEGO C-hands and shoulder guards.
  for(const side of[-1,1]){
    const armKids=[];
    armKids.push(node(side<0?'leftArmUpper':'rightArmUpper',M.greenCyl,[side*.045,-.28,0],[.13,.42,.13],qEuler(0,0,side*.055)));
    armKids.push(node(side<0?'leftArmDarkPanel':'rightArmDarkPanel',M.deepBox,[side*.07,-.28,.125],[.13,.32,.04],qEuler(0,0,side*.06)));
    armKids.push(node(side<0?'leftArmGoldBand':'rightArmGoldBand',M.goldCyl,[side*.09,-.49,0],[.145,.12,.145],qEuler(0,0,side*.10)));
    armKids.push(node(side<0?'leftWrist':'rightWrist',M.skinCyl,[side*.125,-.62,.01],[.082,.14,.082],qEuler(0,0,side*.16)));
    const hand=node(side<0?'leftHand':'rightHand',M.skinCTorus,[side*.145,-.755,.035],[.17,.17,.13],qEuler(0,side<0?Math.PI:0,side<0?-2.42:.72));
    armKids.push(hand);
    armKids.push(node(side<0?'leftShoulderGold':'rightShoulderGold',M.goldBox,[side*.02,.04,-.03],[.28,.14,.48],qEuler(0,0,side*-.06)));
    const arm=node(side<0?'leftArm':'rightArm',null,[side*.5,1.58,0],[1,1,1],qEuler(0,0,side*.18),armKids);
    roots.push(arm);
  }

  // Legs, boots, knee wraps and hip armor.
  for(const side of[-1,1]){
    const legKids=[];
    legKids.push(node(side<0?'leftLegBody':'rightLegBody',M.greenBox,[0,0,0],[.32,.72,.42]));
    legKids.push(node(side<0?'leftLegInner':'rightLegInner',M.deepBox,[side<0?.08:-.08,.02,.215],[.10,.60,.035]));
    legKids.push(node(side<0?'leftKneeWrap':'rightKneeWrap',M.goldBox,[0,.10,.232],[.27,.075,.04],qEuler(0,0,side*.04)));
    legKids.push(node(side<0?'leftBootTop':'rightBootTop',M.blackBox,[0,-.19,.225],[.30,.18,.045]));
    legKids.push(node(side<0?'leftFoot':'rightFoot',M.greenBox,[0,-.39,.06],[.35,.18,.55]));
    legKids.push(node(side<0?'leftSole':'rightSole',M.blackBox,[0,-.49,.075],[.36,.06,.57]));
    legKids.push(node(side<0?'leftToeGold':'rightToeGold',M.goldBox,[0,-.34,.344],[.28,.07,.04]));
    const leg=node(side<0?'leftLeg':'rightLeg',null,[side*.23,.45,0],[1,1,1],undefined,legKids);
    roots.push(leg);
  }

  // Hip belt / sash pieces attached to torso root space for silhouette.
  roots.push(node('hips',M.deepBox,[0,.79,0],[.77,.2,.45]));
  roots.push(node('beltGoldLine',M.goldBox,[0,.83,.235],[.74,.05,.035]));
  roots.push(node('sashTailLeft',M.greenBox,[-.13,.64,.03],[.11,.45,.08],qEuler(.08,0,.14)));
  roots.push(node('sashTailRight',M.greenBox,[.10,.61,.01],[.10,.39,.08],qEuler(-.06,0,-.12)));

  // Twin sword rack and one glowing energy blade as recognizable leader silhouette.
  roots.push(node('backSwordHandle',M.blackCyl,[.30,1.73,-.40],[.06,.48,.06],qEuler(0,0,.48)));
  roots.push(node('backSwordGuard',M.goldBox,[.41,1.95,-.40],[.26,.055,.12],qEuler(0,0,.48)));
  roots.push(node('backSwordBlade',M.steelBox,[.62,2.34,-.40],[.065,.82,.09],qEuler(0,0,.48)));
  roots.push(node('energyBladeHandle',M.blackCyl,[-.67,1.08,.05],[.06,.40,.06],qEuler(0,0,-.28)));
  roots.push(node('energyBladeGuard',M.goldBox,[-.72,1.29,.05],[.28,.055,.12],qEuler(0,0,-.28)));
  roots.push(node('energyBlade',M.energyBox,[-.88,1.75,.05],[.065,.96,.075],qEuler(0,0,-.28)));

  const bin=new Uint8Array(byteLength);let cur=0;for(const c of chunks){bin.set(c,cur);cur+=c.byteLength;}
  const gltf={asset:{version:'2.0',generator:'Ninjago Tournament clean-room detailed Lloyd generator'},scene:0,scenes:[{name:`Fighter_${id}`,nodes:roots}],nodes,meshes,materials,buffers:[{byteLength:bin.byteLength}],bufferViews,accessors};
  let json=enc.encode(JSON.stringify(gltf));const jp=pad4(json.byteLength),jc=new Uint8Array(jp);jc.fill(0x20);jc.set(json);const bpadded=pad4(bin.byteLength),bc=new Uint8Array(bpadded);bc.set(bin);const total=12+8+jc.byteLength+8+bc.byteLength,out=new ArrayBuffer(total),view=new DataView(out),bytes=new Uint8Array(out);let o=0;
  view.setUint32(o,0x46546c67,true);o+=4;view.setUint32(o,2,true);o+=4;view.setUint32(o,total,true);o+=4;view.setUint32(o,jc.byteLength,true);o+=4;view.setUint32(o,0x4e4f534a,true);o+=4;bytes.set(jc,o);o+=jc.byteLength;view.setUint32(o,bc.byteLength,true);o+=4;view.setUint32(o,0x004e4942,true);o+=4;bytes.set(bc,o);
  const output=resolve('public/assets/models/fighters/variants/lloyd-tournament/lloyd-detailed.glb');
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,new Uint8Array(out));
  console.log(JSON.stringify({bytes:total,nodes:nodes.length,meshes:meshes.length,materials:materials.length,required:['torso','head','leftArm','rightArm','leftLeg','rightLeg'].every(n=>nodes.some(x=>x.name===n))},null,2));
}
await generate();

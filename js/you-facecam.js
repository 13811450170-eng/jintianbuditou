// ============================================================================
// you-facecam.js —— 右下角「● YOU」体感小窗(演示页共用) · 普通脚本(非 module)
//
//   按关卡类型显示不同轮廓,由 .you-cam 的 data-track 决定:
//     · 不写 / "face"  → 面部 478 点点云(拳击躲拳等头部动作)
//     · "pose-row"     → 上肢骨架(划船:前倾后仰扩胸,肩/肘/腕/躯干)
//     · "pose-reach"   → 上肢骨架(摘星:抬臂上举)
//
//   分两层,互不拖累:
//   ① 保底层:载入即用纯 canvas 画「装饰轮廓」并做对应动作 —— 不依赖网络,file:// 也能跑。
//   ② 升级层:动态 import MediaPipe(失败被 try/catch 吃掉),摄像头授权后切成真实检测。
//
//   用法:<div class="you-cam" data-track="pose-row"><video…><canvas class="you-mesh">…,
//         然后 <script src="js/you-facecam.js"></script> (放 body 末尾)。
// ============================================================================
(function () {
  const camBox = document.querySelector('.you-cam');
  const canvas = camBox && camBox.querySelector('.you-mesh');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const track = (camBox.dataset.track || 'face').toLowerCase();
  const isPose = track.indexOf('pose') === 0;

  const GOLD_DOT = 'rgba(255,204,0,0.55)';
  const GOLD_LINE = 'rgba(255,230,120,0.9)';
  const WHITE = 'rgba(255,255,255,0.95)';

  let mode = 'deco';       // 'deco'(装饰) → 'real'(真检测)
  let realLandmarks = null;

  function bg() { ctx.clearRect(0,0,W,H); ctx.fillStyle='rgba(255,204,0,0.03)'; ctx.fillRect(0,0,W,H); }
  function drawHint(text){
    bg(); ctx.fillStyle='rgba(255,204,0,0.4)'; ctx.font='12px -apple-system, sans-serif';
    ctx.textAlign='center'; ctx.fillText(text, W/2, H/2);
  }

  // ============================ 面部(FaceLandmarker) ============================
  const FACE_MESH_TRIS = [
    [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],
    [70,63,105,66,107],[336,296,334,293,300],
    [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33],
    [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466,263],
    [168,6,197,195,5,4],
    [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61],
  ];
  function drawFaceReal(lm) {
    bg();
    const P = p => ({ x:(1-p.x)*W, y:p.y*H });
    ctx.fillStyle = GOLD_DOT;
    for (let i=0;i<lm.length;i++){ const p=P(lm[i]); ctx.fillRect(p.x-0.5,p.y-0.5,1.4,1.4); }
    ctx.strokeStyle = GOLD_LINE; ctx.lineWidth = 1;
    for (const path of FACE_MESH_TRIS){
      ctx.beginPath();
      for (let i=0;i<path.length;i++){ const idx=path[i]; if(idx>=lm.length)continue; const p=P(lm[idx]); i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y); }
      ctx.stroke();
    }
    ctx.fillStyle = WHITE;
    for (const idx of [1,33,263]){ if(idx>=lm.length)continue; const p=P(lm[idx]); ctx.beginPath(); ctx.arc(p.x,p.y,1.9,0,Math.PI*2); ctx.fill(); }
  }
  const FACE_DECO = (() => {
    const ell=(cx,cy,rx,ry,n)=>{const a=[];for(let i=0;i<=n;i++){const t=i/n*Math.PI*2;a.push([cx+Math.cos(t)*rx,cy+Math.sin(t)*ry]);}return a;};
    const FACE={ oval:ell(0.5,0.52,0.30,0.40,52), browL:[[0.30,0.38],[0.35,0.35],[0.41,0.34],[0.46,0.36]], browR:[[0.54,0.36],[0.59,0.34],[0.65,0.35],[0.70,0.38]],
      eyeL:ell(0.38,0.46,0.075,0.045,22), eyeR:ell(0.62,0.46,0.075,0.045,22), nose:[[0.50,0.45],[0.50,0.55],[0.482,0.60],[0.50,0.618],[0.518,0.60]],
      nostrils:[[0.472,0.60],[0.50,0.612],[0.528,0.60]], lips:ell(0.50,0.71,0.11,0.055,30), lipLine:[[0.39,0.71],[0.5,0.716],[0.61,0.71]] };
    const LINES=['oval','browL','browR','eyeL','eyeR','nose','nostrils','lips','lipLine'];
    const DOTS=[]; let s=1234567; const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
    for(let i=0;i<380;i++){const t=rnd()*Math.PI*2,r=Math.sqrt(rnd());DOTS.push([0.5+Math.cos(t)*0.275*r,0.52+Math.sin(t)*0.375*r]);}
    return { FACE, LINES, DOTS, anchors:[[0.5,0.578],[0.38,0.46],[0.62,0.46]] };
  })();
  function drawFaceDeco(el) {
    bg();
    const yaw=Math.sin(el*0.7)*0.03, pit=Math.sin(el*0.5+1)*0.02, sc=1+Math.sin(el*0.9)*0.012;
    const P=([x,y])=>({x:(0.5+(x-0.5+yaw)*sc)*W, y:(0.5+(y-0.5+pit)*sc)*H*0.98+H*0.01});
    ctx.fillStyle=GOLD_DOT; for(const d of FACE_DECO.DOTS){const p=P(d);ctx.fillRect(p.x-0.6,p.y-0.6,1.5,1.5);}
    ctx.strokeStyle=GOLD_LINE; ctx.lineWidth=1;
    for(const k of FACE_DECO.LINES){const path=FACE_DECO.FACE[k];ctx.beginPath();path.forEach((pt,i)=>{const p=P(pt);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();}
    ctx.fillStyle=WHITE; for(const a of FACE_DECO.anchors){const p=P(a);ctx.beginPath();ctx.arc(p.x,p.y,1.9,0,Math.PI*2);ctx.fill();}
  }

  // ============================ 上肢骨架(PoseLandmarker) ============================
  // 通用绘制:传入 canvas 像素坐标的关节点(可为 null),画点云 + 骨线 + 白关节
  function addSeg(dots,a,b,step){ if(!a||!b)return; const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),n=Math.max(3,Math.round(len/(step||7))); for(let i=0;i<=n;i++)dots.push([a.x+dx*i/n,a.y+dy*i/n]); }
  function addArc(dots,cx,cy,r,n){ n=n||30; for(let i=0;i<n;i++){const t=i/n*Math.PI*2;dots.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r]);} }
  // 确定性散点填充:每帧同种子 → 点云随关节平滑变形而不闪烁,复刻面部点云的"扫描"密度
  function mkRnd(seed){ let s=(seed>>>0)||1; return ()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }; }
  function fillQuad(dots,a,b,c,d,n,rnd){ if(!a||!b||!c||!d)return; for(let i=0;i<n;i++){ const u=rnd(),v=rnd(); const tx=a.x+(b.x-a.x)*u,ty=a.y+(b.y-a.y)*u, bx=d.x+(c.x-d.x)*u,by=d.y+(c.y-d.y)*u; dots.push([tx+(bx-tx)*v, ty+(by-ty)*v]); } }
  function fillDisc(dots,cx,cy,r,n,rnd){ for(let i=0;i<n;i++){ const t=rnd()*Math.PI*2,rr=Math.sqrt(rnd())*r; dots.push([cx+Math.cos(t)*rr,cy+Math.sin(t)*rr]); } }
  function drawSkeleton(J) {
    bg();
    const bones = [];
    const B=(a,b)=>{ if(J[a]&&J[b]) bones.push([J[a],J[b]]); };
    B('shL','shR'); B('shL','elL'); B('elL','wrL'); B('shR','elR'); B('elR','wrR');
    B('shL','hipL'); B('shR','hipR'); B('hipL','hipR');
    // 颈:双肩中点 → 鼻
    let neck=null, mid=null;
    if(J.shL&&J.shR){ mid={x:(J.shL.x+J.shR.x)/2,y:(J.shL.y+J.shR.y)/2}; if(J.nose) neck=[mid,J.nose]; }

    const rnd=mkRnd(20240816);

    // ① 面状点云:躯干/上臂/前臂当作有宽度的四边形填充,头当圆盘填充 —— 复刻面部点云的密度感
    const cloud=[];
    const perp=(a,b,w)=>{ const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1; return {x:-dy/L*w,y:dx/L*w}; };
    const limb=(a,b,w,n)=>{ if(!a||!b)return; const p=perp(a,b,w); fillQuad(cloud,{x:a.x+p.x,y:a.y+p.y},{x:b.x+p.x,y:b.y+p.y},{x:b.x-p.x,y:b.y-p.y},{x:a.x-p.x,y:a.y-p.y},n,rnd); };
    // 躯干:双肩→双髋 的梯形
    if(J.shL&&J.shR&&J.hipL&&J.hipR) fillQuad(cloud,J.shL,J.shR,J.hipR,J.hipL,210,rnd);
    // 双臂(上臂略粗、前臂略细)
    limb(J.shL,J.elL,7.5,52); limb(J.elL,J.wrL,6,44);
    limb(J.shR,J.elR,7.5,52); limb(J.elR,J.wrR,6,44);
    // 颈
    if(neck) limb(neck[0],neck[1],5,24);
    // 头:圆盘填充 + 轮廓环
    if(J.nose&&J.headR){ fillDisc(cloud,J.nose.x,J.nose.y,J.headR*0.92,150,rnd); addArc(cloud,J.nose.x,J.nose.y,J.headR,48); }
    // 手部小簇(动作端点,给一点密度)
    if(J.wrL) fillDisc(cloud,J.wrL.x,J.wrL.y,7.5,36,rnd);
    if(J.wrR) fillDisc(cloud,J.wrR.x,J.wrR.y,7.5,36,rnd);

    ctx.fillStyle=GOLD_DOT;
    for(let i=0;i<cloud.length;i++){ ctx.fillRect(cloud[i][0]-0.5,cloud[i][1]-0.5,1.4,1.4); }

    // ② 骨线:更细,叠在点云上勾勒结构
    ctx.strokeStyle=GOLD_LINE; ctx.lineWidth=0.9;
    for(const [a,b] of bones){ ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
    if(neck){ ctx.beginPath(); ctx.moveTo(neck[0].x,neck[0].y); ctx.lineTo(neck[1].x,neck[1].y); ctx.stroke(); }
    if(J.nose&&J.headR){ ctx.beginPath(); ctx.arc(J.nose.x,J.nose.y,J.headR,0,Math.PI*2); ctx.stroke(); }

    // ③ 白关节:双肩 + 双腕(动作端点)+ 双肘(次要)
    ctx.fillStyle=WHITE;
    for(const k of ['shL','shR','wrL','wrR']){ if(J[k]){ ctx.beginPath(); ctx.arc(J[k].x,J[k].y,2.4,0,Math.PI*2); ctx.fill(); } }
    ctx.fillStyle='rgba(255,255,255,0.6)';
    for(const k of ['elL','elR']){ if(J[k]){ ctx.beginPath(); ctx.arc(J[k].x,J[k].y,1.7,0,Math.PI*2); ctx.fill(); } }
  }

  // 真实上肢:把 pose landmarks 拟合进小窗(按上肢包围盒缩放居中,镜像 x)
  function drawPoseReal(lm) {
    const IDX=[0,11,12,13,14,15,16,23,24];
    let minX=1,minY=1,maxX=0,maxY=0,any=false;
    const vis=p=>(p.visibility==null?1:p.visibility);
    for(const i of IDX){ const p=lm[i]; if(!p||vis(p)<0.3)continue; const x=1-p.x,y=p.y; any=true; if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    if(!any){ drawHint('SEARCHING…'); return; }
    const bw=Math.max(0.001,maxX-minX), bh=Math.max(0.001,maxY-minY), PAD=22;
    let scale=Math.min((W-2*PAD)/(bw*W),(H-2*PAD)/(bh*H)); scale=Math.min(scale,2.6);
    const offX=(W-bw*W*scale)/2-minX*W*scale, offY=(H-bh*H*scale)/2-minY*H*scale;
    const g=i=>{ const p=lm[i]; if(!p||vis(p)<0.3)return null; return { x:(1-p.x)*W*scale+offX, y:p.y*H*scale+offY }; };
    const shL=g(11),shR=g(12);
    let headR=16; if(shL&&shR) headR=Math.max(12,Math.hypot(shR.x-shL.x,shR.y-shL.y)*0.34);
    drawSkeleton({ nose:g(0), shL, shR, elL:g(13), elR:g(14), wrL:g(15), wrR:g(16), hipL:g(23), hipR:g(24), headR });
  }

  // 装饰上肢:根据关卡做对应动作(归一化 [0,1] → 像素,含轻微呼吸)
  const lerp=(a,b,t)=>a+(b-a)*t;
  function rowJoints(el){ // 划船:前倾伸展(catch)→ 后仰拉桨到胸(finish)
    const ph=(Math.sin(el*1.5)+1)/2, lean=(1-ph)*0.03, shY=0.42+lean;
    return {
      nose:[0.5,0.23+lean*1.3], shL:[0.35,shY], shR:[0.65,shY],
      elL:[lerp(0.40,0.30,ph),lerp(0.56,0.52,ph)], elR:[lerp(0.60,0.70,ph),lerp(0.56,0.52,ph)],
      wrL:[lerp(0.46,0.40,ph),lerp(0.66,0.46,ph)], wrR:[lerp(0.54,0.60,ph),lerp(0.66,0.46,ph)],
      hipL:[0.40,shY+0.30], hipR:[0.60,shY+0.30],
    };
  }
  function reachJoints(el){ // 摘星:双臂由体侧上举过头,向中间够
    const ph=(Math.sin(el*1.3)+1)/2, alt=Math.sin(el*2.0)*0.012;
    return {
      nose:[0.5,0.27], shL:[0.35,0.46], shR:[0.65,0.46],
      elL:[lerp(0.26,0.34,ph),lerp(0.50,0.28,ph)], elR:[lerp(0.74,0.66,ph),lerp(0.50,0.28,ph)],
      wrL:[lerp(0.22,0.40,ph)+alt,lerp(0.42,0.12,ph)], wrR:[lerp(0.78,0.60,ph)-alt,lerp(0.42,0.12,ph)],
      hipL:[0.42,0.74], hipR:[0.58,0.74],
    };
  }
  function drawPoseDeco(el){
    const NJ = (track==='pose-reach') ? reachJoints(el) : rowJoints(el);
    const ox=Math.sin(el*0.8)*3, oy=Math.sin(el*0.6)*2;
    const P=([x,y])=>({x:x*W+ox, y:y*H+oy});
    const J={}; for(const k in NJ) J[k]=P(NJ[k]);
    J.headR = Math.abs(J.shR.x-J.shL.x)*0.34;
    drawSkeleton(J);
  }

  // ============================ 渲染循环 & 升级 ============================
  let t0=0;
  function frame(ts){
    if(!t0) t0=ts; const el=(ts-t0)/1000;
    if(mode==='real'){
      if(!realLandmarks) drawHint('SEARCHING…');
      else if(isPose) drawPoseReal(realLandmarks);
      else drawFaceReal(realLandmarks);
    } else {
      isPose ? drawPoseDeco(el) : drawFaceDeco(el);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  (async function upgrade(){
    if(!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return;
    let mod;
    try { mod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'); }
    catch(e){ return; }
    const { FaceLandmarker, PoseLandmarker, FilesetResolver } = mod;

    let detector;
    try {
      const resolver = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      if(isPose){
        detector = await PoseLandmarker.createFromOptions(resolver, {
          baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate:'GPU' },
          runningMode:'VIDEO', numPoses:1,
        });
      } else {
        detector = await FaceLandmarker.createFromOptions(resolver, {
          baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate:'GPU' },
          runningMode:'VIDEO', numFaces:1,
        });
      }
    } catch(e){ return; }

    let video = camBox.querySelector('video');
    if(!video){
      video = document.createElement('video');
      video.setAttribute('playsinline',''); video.muted=true;
      video.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
      camBox.appendChild(video);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ideal:640}, height:{ideal:480}, facingMode:'user' }, audio:false });
      video.srcObject = stream;
      await video.play();
      await new Promise(res=>{ video.readyState>=2 ? res() : (video.onloadeddata=()=>res()); });
    } catch(e){ return; }

    mode = 'real';
    let lastT=-1;
    function detect(now){
      if(video.readyState>=2 && video.currentTime!==lastT){
        lastT=video.currentTime;
        let res=null; try{ res=detector.detectForVideo(video, now); }catch(e){}
        if(isPose) realLandmarks = (res && res.landmarks && res.landmarks.length>0) ? res.landmarks[0] : null;
        else       realLandmarks = (res && res.faceLandmarks && res.faceLandmarks.length>0) ? res.faceLandmarks[0] : null;
      }
      requestAnimationFrame(detect);
    }
    requestAnimationFrame(detect);
  })();
})();

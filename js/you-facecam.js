// ============================================================================
// you-facecam.js —— 右下角「● YOU」点阵脸小窗(演示页共用) · 普通脚本(非 module)
//
//   分两层,互不拖累:
//   ① 保底层:载入即用纯 canvas 画「装饰点阵脸」——不依赖任何网络,file:// 双击也能跑,
//              保证小窗永远不空。
//   ② 升级层:用「动态 import()」按需拉 MediaPipe(失败被 try/catch 吃掉,不影响①),
//              成功且摄像头授权后,切换成你的真脸 478 点点云(与拳击关一致)。
//
//   用法:<div class="you-cam"><video…><canvas class="you-mesh">…,
//         然后 <script src="js/you-facecam.js"></script> (放 body 末尾) 即可。
// ============================================================================
(function () {
  const canvas = document.querySelector('.you-cam .you-mesh');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // 状态:'deco'(装饰保底) → 'real'(真摄像头)
  let mode = 'deco';
  let realLandmarks = null;

  // ---------- 真脸连线(MediaPipe 官方索引子集) ----------
  const FACE_MESH_TRIS = [
    [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],
    [70,63,105,66,107],
    [336,296,334,293,300],
    [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33],
    [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466,263],
    [168,6,197,195,5,4],
    [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61],
  ];

  function drawReal(landmarks) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,204,0,0.03)'; ctx.fillRect(0, 0, W, H);
    const project = p => ({ x: (1 - p.x) * W, y: p.y * H }); // 镜像 x,与用户视觉一致
    ctx.fillStyle = 'rgba(255,204,0,0.55)';
    for (let i = 0; i < landmarks.length; i++) {
      const p = project(landmarks[i]);
      ctx.fillRect(p.x - 0.5, p.y - 0.5, 1.4, 1.4);
    }
    ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 1;
    for (const path of FACE_MESH_TRIS) {
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const idx = path[i];
        if (idx >= landmarks.length) continue;
        const p = project(landmarks[idx]);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const idx of [1, 33, 263]) {
      if (idx >= landmarks.length) continue;
      const p = project(landmarks[idx]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.9, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHint(text) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,204,0,0.03)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,204,0,0.4)';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, H / 2);
  }

  // ---------- 装饰保底脸:稠密点云 + 结构线 + 轻微摇摆呼吸 ----------
  const DECO = (() => {
    const ellipse = (cx,cy,rx,ry,n,from=0,to=Math.PI*2) => {
      const a=[]; for(let i=0;i<=n;i++){const t=from+(to-from)*i/n;a.push([cx+Math.cos(t)*rx,cy+Math.sin(t)*ry]);} return a;
    };
    const FACE = {
      oval: ellipse(0.5,0.52,0.30,0.40,52),
      browL: [[0.30,0.38],[0.35,0.35],[0.41,0.34],[0.46,0.36]],
      browR: [[0.54,0.36],[0.59,0.34],[0.65,0.35],[0.70,0.38]],
      eyeL: ellipse(0.38,0.46,0.075,0.045,22),
      eyeR: ellipse(0.62,0.46,0.075,0.045,22),
      nose: [[0.50,0.45],[0.50,0.55],[0.482,0.60],[0.50,0.618],[0.518,0.60]],
      nostrils: [[0.472,0.60],[0.50,0.612],[0.528,0.60]],
      lips: ellipse(0.50,0.71,0.11,0.055,30),
      lipLine: [[0.39,0.71],[0.5,0.716],[0.61,0.71]],
    };
    const LINES = ['oval','browL','browR','eyeL','eyeR','nose','nostrils','lips','lipLine'];
    // 稠密点云(固定种子,不用 Math.random 以便可复现)
    const DOTS = [];
    let s = 1234567; const rnd = () => { s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
    for (let i=0;i<380;i++){ const t=rnd()*Math.PI*2, r=Math.sqrt(rnd()); DOTS.push([0.5+Math.cos(t)*0.275*r, 0.52+Math.sin(t)*0.375*r]); }
    const anchors = [[0.5,0.578],[0.38,0.46],[0.62,0.46]];
    return { FACE, LINES, DOTS, anchors };
  })();

  let decoT0 = 0;
  function drawDeco(ts) {
    if (!decoT0) decoT0 = ts; const el = (ts - decoT0) / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,204,0,0.03)'; ctx.fillRect(0, 0, W, H);
    const yaw = Math.sin(el*0.7)*0.03, pit = Math.sin(el*0.5+1)*0.02, sc = 1+Math.sin(el*0.9)*0.012;
    const P = ([x,y]) => ({ x:(0.5+(x-0.5+yaw)*sc)*W, y:(0.5+(y-0.5+pit)*sc)*H*0.98+H*0.01 });
    ctx.fillStyle = 'rgba(255,204,0,0.5)';
    for (const d of DECO.DOTS){ const p=P(d); ctx.fillRect(p.x-0.6,p.y-0.6,1.5,1.5); }
    ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 1;
    for (const k of DECO.LINES){ const path=DECO.FACE[k]; ctx.beginPath(); path.forEach((pt,i)=>{const p=P(pt); i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const a of DECO.anchors){ const p=P(a); ctx.beginPath(); ctx.arc(p.x,p.y,1.9,0,Math.PI*2); ctx.fill(); }
  }

  // ---------- 单一渲染循环:按 mode 决定画什么,永不空窗 ----------
  function frame(ts) {
    if (mode === 'real') {
      realLandmarks ? drawReal(realLandmarks) : drawHint('SEARCHING…');
    } else {
      drawDeco(ts);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- 升级层:动态 import,失败静默保持装饰脸 ----------
  (async function upgrade() {
    // 非安全上下文(file:// 等)下 getUserMedia 不可用,直接不升级,保持装饰脸
    if (!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return;

    let FaceLandmarker, FilesetResolver;
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      FaceLandmarker = mod.FaceLandmarker; FilesetResolver = mod.FilesetResolver;
    } catch (e) { return; }

    let faceLandmarker;
    try {
      const resolver = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO', numFaces: 1,
      });
    } catch (e) { return; }

    let video = document.querySelector('.you-cam video');
    if (!video) {
      video = document.createElement('video');
      video.setAttribute('playsinline', ''); video.muted = true;
      video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.querySelector('.you-cam').appendChild(video);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ideal:640}, height:{ideal:480}, facingMode:'user' }, audio: false,
      });
      video.srcObject = stream;
      await video.play();
      await new Promise(res => { video.readyState >= 2 ? res() : (video.onloadeddata = () => res()); });
    } catch (e) { return; }

    // 升级成功:切到 real 模式,检测循环持续喂 landmarks
    mode = 'real';
    let lastT = -1;
    function detect(now) {
      if (video.readyState >= 2 && video.currentTime !== lastT) {
        lastT = video.currentTime;
        let res = null;
        try { res = faceLandmarker.detectForVideo(video, now); } catch (e) {}
        realLandmarks = (res && res.faceLandmarks && res.faceLandmarks.length > 0) ? res.faceLandmarks[0] : null;
      }
      requestAnimationFrame(detect);
    }
    requestAnimationFrame(detect);
  })();
})();

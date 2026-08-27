// ============================================================================
// joy-mask.js —— 右下角小窗「Joy 卡通面具」共用模块
//
//   把 Joy 头部立绘(img/joy-head.png,含双耳+五官,透明底)按脸部关键点实时贴到
//   真脸上:跟随位移、按脸宽缩放、随歪头旋转。严格等比,绝不拉伸变形(IP 规范)。
//
//   两种接入(按关卡检测底盘选一):
//   1) Face Mesh 关卡(拳击/午餐/眨眼):
//        JoyMask.draw(ctx, landmarks478, w, h)
//        依赖 鼻尖1 / 右眼外角33 / 左眼外角263(镜像后 33 在画面右、263 在画面左)。
//   2) Pose 骨架关卡(摘星等,无面部网格,但有头部点):
//        JoyMask.drawByPoints(ctx, {nose, earL, earR}, {scale})
//        传入"已投影到 canvas 像素、且已镜像"的点(与该关骨架同坐标系),
//        earL/earR 为画面左/右耳,用于定宽度与歪头角;nose 定中心。
//
//   注意:调用前 ctx 应已 clearRect;本模块只画面具,不清屏、不画背景。
// ============================================================================
(function (global) {
  const img = new Image();
  let ready = false;
  img.onload = () => { ready = true; };
  img.src = 'img/joy-head.png';

  const DEFAULTS = { scale: 2.7, dropY: 0.10 };

  // 底层:在给定中心 cx,cy、脸宽 faceW、歪头角 roll 处贴 Joy 头(严格等比)
  function blit(ctx, cx, cy, faceW, roll) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    if (ready) {
      const ratio = img.naturalHeight / img.naturalWidth;  // 265/300
      const drawW = faceW;
      const drawH = drawW * ratio;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      const r = faceW * 0.45;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.restore();
  }

  // Face Mesh 关卡:用 478 点的双眼角定位
  function draw(ctx, L, w, h, opts) {
    if (!ctx || !L || L.length === 0) return;
    const need = [1, 33, 263];
    for (const i of need) { if (i >= L.length) return; }
    const o = opts || DEFAULTS;
    const scale = o.scale != null ? o.scale : DEFAULTS.scale;
    const dropY = o.dropY != null ? o.dropY : DEFAULTS.dropY;

    const project = p => ({ x: (1 - p.x) * w, y: p.y * h });  // 镜像 x
    const eyeRight = project(L[33]), eyeLeft = project(L[263]);
    let roll = Math.atan2(eyeRight.y - eyeLeft.y, eyeRight.x - eyeLeft.x);
    if (Math.abs(roll) > Math.PI / 2) { roll = roll > 0 ? roll - Math.PI : roll + Math.PI; }
    const eyeDist = Math.hypot(eyeRight.x - eyeLeft.x, eyeRight.y - eyeLeft.y);
    const cx = (eyeRight.x + eyeLeft.x) / 2;
    const cy = (eyeRight.y + eyeLeft.y) / 2 + eyeDist * dropY;
    blit(ctx, cx, cy, eyeDist * scale, roll);
  }

  // Pose 骨架关卡:传入已投影(镜像后)的头部像素点 {nose, earL, earR}
  // earL/earR = 画面左/右耳。用耳距定宽度、耳连线定歪头角、鼻定中心。
  function drawByPoints(ctx, pts, opts) {
    if (!ctx || !pts) return;
    const o = opts || {};
    const scale = o.scale != null ? o.scale : 1.9;  // 耳距→脸宽系数(耳距≈脸宽,略放大含耳朵)
    const earL = pts.earL, earR = pts.earR, nose = pts.nose;
    if (!earL || !earR) return;
    let roll = Math.atan2(earR.y - earL.y, earR.x - earL.x);
    if (Math.abs(roll) > Math.PI / 2) { roll = roll > 0 ? roll - Math.PI : roll + Math.PI; }
    const earDist = Math.hypot(earR.x - earL.x, earR.y - earL.y);
    // 中心:优先用鼻,回退到双耳中点
    const cx = nose ? nose.x : (earL.x + earR.x) / 2;
    const cy = nose ? nose.y : (earL.y + earR.y) / 2;
    blit(ctx, cx, cy, earDist * scale, roll);
  }

  global.JoyMask = { draw, drawByPoints, isReady: () => ready };
})(window);

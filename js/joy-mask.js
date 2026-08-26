// ============================================================================
// joy-mask.js —— 右下角小窗「Joy 卡通面具」共用模块(Face Mesh 关卡通用)
//
//   把 Joy 头部立绘(img/joy-head.png,含双耳+五官,透明底)按面部关键点实时贴到
//   真脸上:跟随位移、按眼距缩放、随歪头旋转。严格等比,绝不拉伸变形(IP 规范)。
//
//   用法(各关在自己的每帧绘制里调):
//     JoyMask.draw(ctx, landmarks, canvasW, canvasH);
//   - ctx        : 小窗 mesh canvas 的 2D context
//   - landmarks  : MediaPipe Face Mesh 的 478 点(归一化坐标 {x,y})
//   - canvasW/H  : canvas 内部像素宽高
//   依赖锚点:鼻尖1 / 右眼外角33 / 左眼外角263(镜像后 33 在画面右、263 在画面左)。
//
//   注意:调用前 ctx 应已 clearRect;本模块只负责画面具,不清屏、不画背景。
// ============================================================================
(function (global) {
  const img = new Image();
  let ready = false;
  img.onload = () => { ready = true; };
  img.src = 'img/joy-head.png';

  // 可调参数(三关统一;个别关要微调可在 draw 的 opts 里覆盖)
  const DEFAULTS = {
    scale: 2.7,      // 贴图宽度 = 眼距 × scale
    dropY: 0.10,     // 锚点从两眼中点向下移 = 眼距 × dropY
  };

  function draw(ctx, L, w, h, opts) {
    if (!ctx || !L || L.length === 0) return;
    const need = [1, 33, 263];
    for (const i of need) { if (i >= L.length) return; }
    const o = opts || DEFAULTS;
    const scale = o.scale != null ? o.scale : DEFAULTS.scale;
    const dropY = o.dropY != null ? o.dropY : DEFAULTS.dropY;

    // 镜像投影:x 翻转,与用户视觉一致
    const project = p => ({ x: (1 - p.x) * w, y: p.y * h });
    const eyeRight = project(L[33]), eyeLeft = project(L[263]);
    // 歪头角:用"画面左眼→右眼"向量(33 - 263);反向会把脸转 180°(倒置),故加兜底
    let roll = Math.atan2(eyeRight.y - eyeLeft.y, eyeRight.x - eyeLeft.x);
    if (Math.abs(roll) > Math.PI / 2) { roll = roll > 0 ? roll - Math.PI : roll + Math.PI; }
    const eyeDist = Math.hypot(eyeRight.x - eyeLeft.x, eyeRight.y - eyeLeft.y);
    const eyeMidX = (eyeRight.x + eyeLeft.x) / 2, eyeMidY = (eyeRight.y + eyeLeft.y) / 2;

    ctx.save();
    ctx.translate(eyeMidX, eyeMidY + eyeDist * dropY);
    ctx.rotate(roll);
    if (ready) {
      const ratio = img.naturalHeight / img.naturalWidth;  // 265/300
      const drawW = eyeDist * scale;
      const drawH = drawW * ratio;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      const r = eyeDist * 0.9;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.restore();
  }

  global.JoyMask = { draw, isReady: () => ready };
})(window);

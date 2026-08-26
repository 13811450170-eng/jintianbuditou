// ============================================================================
// facecam-toggle.js —— 右下角「● YOU」小窗的「实写 ⇄ 点阵」开关(演示页共用)
//
//   默认显示真实摄像头画面(镜像);鼠标悬停时盖黑色蒙版并出现「关闭人脸影像」,
//   点击切成点阵形象(you-mesh canvas 由 you-facecam.js / 各关自绘脚本负责渲染),
//   再次点击切回实写。摄像头未就绪 / 未授权时自动退回点阵,直到画面到位。
//
//   不改各关 CSS:video 的显隐用 inline style 覆盖(优先级最高),
//   canvas 的显隐用 opacity 切换(绘制不停,零改动)。
//
//   用法:各关 body 末尾 <script src="js/facecam-toggle.js"></script>(放在
//         you-facecam.js / 关卡脚本之后即可,只依赖 .you-cam > video + .you-mesh)。
// ============================================================================
(function () {
  const boxes = document.querySelectorAll('.you-cam');
  if (!boxes.length) return;

  const EYE_ON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  const style = document.createElement('style');
  style.textContent = `
  .you-cam .you-label{ z-index:3; }
  /* 常驻底部控制条:始终可见,让用户第一眼就知道能关 */
  .fc-toggle{
    position:absolute; left:0; right:0; bottom:0; z-index:4;
    display:flex; align-items:center; justify-content:center; gap:5px;
    margin:0; padding:7px 6px; border:0; cursor:pointer; white-space:nowrap;
    background:linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,.32) 70%, rgba(0,0,0,0));
    color:#fff; font:800 11px/1 -apple-system,system-ui,sans-serif; letter-spacing:.5px;
    transition:background .18s ease;
    -webkit-tap-highlight-color:transparent;
  }
  .fc-toggle:hover, .fc-toggle:focus-visible{ background:linear-gradient(to top, rgba(0,0,0,.88), rgba(0,0,0,.5) 70%, rgba(0,0,0,.1)); outline:none; }
  .fc-toggle .fc-ico{ display:inline-flex; }
  .fc-toggle .fc-ico svg{ width:14px; height:14px; display:block; }
  /* 首次进入引导气泡:指向小窗,4s 后自动消失或点击关闭 */
  .fc-tip{
    position:absolute; right:0; bottom:calc(100% + 10px); z-index:6;
    width:184px; padding:10px 13px; border-radius:10px; cursor:pointer;
    background:rgba(20,20,22,.92); border:1px solid rgba(255,204,0,.4);
    color:#fff; font:500 12px/1.55 -apple-system,system-ui,sans-serif;
    box-shadow:0 6px 20px rgba(0,0,0,.4);
    animation:fcTipIn .28s ease;
  }
  .fc-tip b{ color:#ffcc00; font-weight:800; }
  .fc-tip::after{
    content:''; position:absolute; right:26px; bottom:-7px;
    border:7px solid transparent; border-top-color:rgba(20,20,22,.92); border-bottom:none;
  }
  .fc-tip.fc-hide{ display:none; }
  @keyframes fcTipIn{ from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:translateY(0);} }
  `;
  document.head.appendChild(style);

  // ---- 首次进入引导气泡(全页面只弹一次,localStorage 记忆)----
  const TIP_KEY = 'chinup_facecam_tip_seen';
  let tipEl = null, tipTimer = 0, tipDone = false;
  function dismissTip() {
    tipDone = true;
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = 0; }
    if (tipEl) { tipEl.remove(); tipEl = null; }
    try { localStorage.setItem(TIP_KEY, '1'); } catch (e) {}
  }
  function maybeShowTip(camBox) {
    if (tipDone || tipEl) return;                       // 已弹过 / 本次已在展示
    try { if (localStorage.getItem(TIP_KEY)) { tipDone = true; return; } } catch (e) {}
    tipEl = document.createElement('div');
    tipEl.className = 'fc-tip';
    tipEl.innerHTML = '在意隐私？点下方<b>关闭人脸影像</b><br>改用点阵形象,不影响游戏';
    tipEl.addEventListener('click', dismissTip);
    camBox.appendChild(tipEl);
    tipTimer = setTimeout(dismissTip, 5000);
  }

  boxes.forEach(setup);

  function setup(camBox) {
    const video = camBox.querySelector('video');
    const mesh = camBox.querySelector('.you-mesh');
    if (!video || !mesh) return;

    // video 覆盖成全窗镜像铺满(默认先藏,camAlive 后再亮),优先级压过各关 CSS 的 1px 隐藏
    video.style.position = 'absolute';
    video.style.left = '0';
    video.style.top = '0';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.transform = 'scaleX(-1)';
    video.style.pointerEvents = 'none';
    video.style.opacity = '0';
    video.style.zIndex = '1';
    // canvas 叠在 video 之上,靠 opacity 显隐
    mesh.style.position = 'relative';
    mesh.style.zIndex = '2';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fc-toggle';
    btn.innerHTML = '<span class="fc-ico"></span><span class="fc-txt"></span>';
    camBox.appendChild(btn);

    let mode = 'camera'; // 'camera'(实写/卡通脸) | 'mesh'(点阵)
    // 卡通面具关卡:标记 .you-cam[data-mask] 时,camera 态下 mesh 画布保持可见,
    // 由关卡脚本据 camBox.dataset.faceMode 决定画“面具”(camera)还是“点阵”(mesh)。
    const hasMask = camBox.hasAttribute('data-mask');
    function syncLabel() {
      const cam = mode === 'camera';
      btn.querySelector('.fc-txt').textContent = cam ? '关闭人脸影像' : '开启人脸影像';
      btn.querySelector('.fc-ico').innerHTML = cam ? EYE_OFF : EYE_ON;
      btn.setAttribute('aria-label', cam ? '关闭人脸影像,改用点阵形象' : '开启人脸影像');
      camBox.dataset.faceMode = mode;   // 暴露给关卡脚本
    }
    syncLabel();

    btn.addEventListener('click', () => {
      mode = mode === 'camera' ? 'mesh' : 'camera';
      syncLabel();
      dismissTip();          // 用户已发现按钮,气泡任务完成
    });

    maybeShowTip(camBox);

    let shown = null;
    (function loop() {
      const camAlive = video.readyState >= 2 && video.videoWidth > 0 && !video.paused;
      const showCam = mode === 'camera' && camAlive;
      if (showCam !== shown) {
        shown = showCam;
        video.style.opacity = showCam ? '1' : '0';
        // 面具关卡:camera 态 mesh 层要盖在真脸上显示卡通脸,故保持可见;
        //          普通关卡 camera 态才把 mesh(点阵)藏起来。
        mesh.style.opacity = (showCam && !hasMask) ? '0' : '1';
      }
      requestAnimationFrame(loop);
    })();
  }
})();

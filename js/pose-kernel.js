// ============================================================
// pose-kernel.js · 头姿检测共享内核（今天不低头 · 产品线骨架）
// ------------------------------------------------------------
// 职责边界(薄核)：video 帧 → MediaPipe FaceLandmarker → 三轴头姿角度
//   → EMA 平滑 → 应用校准基线 + 轴向符号 → 输出「相对中立位的三轴角 rel」
//   及辅助信号(鼻尖/眼距/是否有脸)。
//
// 不做的事(留给各关卡游戏侧，保证"改一关不碰内核")：
//   - 达标角度 reach / 灵敏度滑杆 / 各关卡阈值(切道/跳/蹲判定)
//   - 甩头速度 vel 的消费、prevRel 维护、updateWorldFromHead 等游戏逻辑
//   - 任何 DOM / 画面渲染
//
// 隐私红线：只处理角度/坐标数值，绝不缓存、上传、导出任何画面帧。
//   stopCamera() 提供「关卡结束立即释放摄像头」的能力。
//
// 安全/难度阈值(保持时长、防甩头速度、过头护栏…)是「每关注入的 tuning」，
//   不烘死在内核里——四关现值发散，收敛是设计决策，不是重构。
// ============================================================

import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

export const KERNEL_VERSION = '1.0.0';

// MediaPipe 资源地址(四关一致，集中一处便于将来切内网自托管)
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// 关键地标下标
const NOSE_TIP = 1;
const EYE_L = 263, EYE_R = 33;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// 列主序 4x4 变换矩阵 → 欧拉角(度)。yaw=转头 pitch=俯仰 roll=侧倾。
// 纯函数，与 mock-walk.html 原 matrixToEuler 逐行等价。
export function matrixToEuler(m) {
  const r00 = m[0], r10 = m[1], r20 = m[2], r21 = m[6], r22 = m[10];
  const yaw = Math.asin(clamp(-r20, -1, 1));
  const pitch = Math.atan2(r21, r22);
  const roll = Math.atan2(r10, r00);
  const D = 180 / Math.PI;
  return { yaw: yaw * D, pitch: pitch * D, roll: roll * D };
}

function avg(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

/**
 * 创建头姿检测内核。
 *
 * @param {Object} opts
 * @param {HTMLVideoElement} opts.video  摄像头视频元素(游戏侧提供)
 * @param {Object}  [opts.axis]          轴向符号，默认 { yaw:-1, pitch:1, roll:1 }(镜像实测值)
 * @param {number}  [opts.smooth=0.35]   角度 EMA 系数(散步 0.35 / 喂饭·烟花 0.25)
 * @param {number}  [opts.eyeSmooth=0.2] 眼距 EMA 系数
 * @param {number}  [opts.camWidth=960]  期望相机宽
 * @param {number}  [opts.camHeight=720] 期望相机高
 * @returns 内核实例
 */
export function createPoseKernel(opts = {}) {
  const video = opts.video;
  const AX = opts.axis || { yaw: -1, pitch: 1, roll: 1 };
  const SMOOTH = opts.smooth ?? 0.35;
  const EYE_SMOOTH = opts.eyeSmooth ?? 0.2;
  const camW = opts.camWidth ?? 960;
  const camH = opts.camHeight ?? 720;

  let faceLandmarker = null;
  let stream = null;
  let lastVideoTime = -1;

  // ——— 检测状态(内核内部持有) ———
  let rawNose = { x: 0.5, y: 0.5 };
  let smoothNose = { x: 0.5, y: 0.5 };
  let rawAngle = { yaw: 0, pitch: 0, roll: 0 };
  let smoothAngle = { yaw: 0, pitch: 0, roll: 0 };
  let angleBase = { yaw: 0, pitch: 0, roll: 0 };   // 校准中立基线
  let rawEyeDist = 0.12, smoothEyeDist = 0.12, baseEyeDist = 0.12;
  let facePresent = false;
  let haveMatrix = false;
  let latestLandmarks = null;   // 最新一帧原始 landmarks(可选,供点阵头等绘制)

  // 校准采集
  let calibrating = false;
  let calSamples = [];

  // 相对中立基线、应用轴向符号后的三轴角
  function relAngle() {
    return {
      yaw:   AX.yaw   * (smoothAngle.yaw   - angleBase.yaw),
      pitch: AX.pitch * (smoothAngle.pitch - angleBase.pitch),
      roll:  AX.roll  * (smoothAngle.roll  - angleBase.roll),
    };
  }

  return {
    version: KERNEL_VERSION,
    axis: AX,

    // ——— 初始化 ———
    // onStatus(text)：可选，用于游戏侧更新"正在唤醒 Joy…"之类的加载提示
    async loadModel(onStatus) {
      if (onStatus) onStatus('正在唤醒 Joy…（首次约需几秒）');
      const resolver = await FilesetResolver.forVisionTasks(WASM_URL);
      faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO", numFaces: 1,
        outputFacialTransformationMatrixes: true,
      });
      if (onStatus) onStatus('');
      return faceLandmarker;
    },

    async startCamera() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: camW }, height: { ideal: camH }, facingMode: 'user' },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      await new Promise(res => { if (video.readyState >= 2) res(); else video.onloadeddata = () => res(); });
    },

    // 隐私红线：关卡结束立即释放摄像头，不做热启动
    stopCamera() {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      if (video) video.srcObject = null;
    },

    ready() { return !!faceLandmarker && video && video.readyState >= 2; },

    // ——— 校准：采集若干帧取均值为中立基线 ———
    // 游戏侧负责倒计时 UI；内核负责采集与求均值(与原 calibrate 逐行等价)。
    beginCalibration() { calibrating = true; calSamples = []; },
    endCalibration() {
      calibrating = false;
      if (calSamples.length > 5) {
        baseEyeDist = avg(calSamples.map(s => s.eye));
        angleBase.yaw = avg(calSamples.map(s => s.yaw));
        angleBase.pitch = avg(calSamples.map(s => s.pitch));
        angleBase.roll = avg(calSamples.map(s => s.roll));
        smoothNose.x = avg(calSamples.map(s => s.x));
        smoothNose.y = avg(calSamples.map(s => s.y));
      }
      smoothAngle = { ...rawAngle };
      smoothEyeDist = baseEyeDist;
      calSamples = [];
      return { angleBase: { ...angleBase }, baseEyeDist };
    },

    // ——— 每帧驱动：detect + 平滑，返回当前 pose 快照 ———
    // 游戏侧在自己的 requestAnimationFrame loop 里调 tick(now)。
    // 返回 null 表示模型/视频未就绪(游戏侧应跳过本帧)。
    // 返回对象:
    //   { facePresent, haveMatrix, rel:{yaw,pitch,roll},
    //     angle:{...平滑绝对角}, nose:{x,y}, eyeDist, baseEyeDist }
    tick(now) {
      if (!faceLandmarker || !video || video.readyState < 2) return null;

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        let res = null;
        try { res = faceLandmarker.detectForVideo(video, now); } catch {}
        if (res && res.faceLandmarks && res.faceLandmarks.length > 0) {
          const face = res.faceLandmarks[0];
          latestLandmarks = face;
          const lm = face[NOSE_TIP];
          rawNose.x = 1 - lm.x; rawNose.y = lm.y;
          const el = face[EYE_L], er = face[EYE_R];
          rawEyeDist = Math.hypot(el.x - er.x, el.y - er.y);
          facePresent = true;
          const mtx = res.facialTransformationMatrixes;
          if (mtx && mtx.length > 0 && mtx[0].data) {
            rawAngle = matrixToEuler(mtx[0].data);
            haveMatrix = true;
          }
        } else {
          facePresent = false;
          latestLandmarks = null;
        }
      }

      // 校准采集(只在 beginCalibration~endCalibration 之间、且有脸时)
      if (calibrating && facePresent) {
        calSamples.push({ x: rawNose.x, y: rawNose.y, yaw: rawAngle.yaw, pitch: rawAngle.pitch, roll: rawAngle.roll, eye: rawEyeDist });
      }

      // EMA 平滑(与原 loop 878-883 等价)
      smoothNose.x += (rawNose.x - smoothNose.x) * SMOOTH;
      smoothNose.y += (rawNose.y - smoothNose.y) * SMOOTH;
      smoothEyeDist += (rawEyeDist - smoothEyeDist) * EYE_SMOOTH;
      smoothAngle.yaw   += (rawAngle.yaw   - smoothAngle.yaw)   * SMOOTH;
      smoothAngle.pitch += (rawAngle.pitch - smoothAngle.pitch) * SMOOTH;
      smoothAngle.roll  += (rawAngle.roll  - smoothAngle.roll)  * SMOOTH;

      return {
        facePresent, haveMatrix,
        rel: relAngle(),
        angle: { ...smoothAngle },
        snapshotRaw: { ...rawAngle },
        nose: { x: smoothNose.x, y: smoothNose.y },
        eyeDist: smoothEyeDist,
        baseEyeDist,
        landmarks: latestLandmarks,   // 原始 landmarks(供点阵头绘制;无脸时 null)
      };
    },

    // 只读快照(调试/埋点用)
    snapshot() {
      return {
        facePresent, haveMatrix,
        rel: relAngle(),
        angle: { ...smoothAngle },
        rawAngle: { ...rawAngle },
        angleBase: { ...angleBase },
        nose: { x: smoothNose.x, y: smoothNose.y },
        eyeDist: smoothEyeDist, baseEyeDist,
      };
    },
  };
}

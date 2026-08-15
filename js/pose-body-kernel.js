// ============================================================
// pose-body-kernel.js · 上肢姿态检测内核(肩部测评用)
// ------------------------------------------------------------
// 职责边界(薄核,与 pose-kernel.js 对称):
//   video 帧 → MediaPipe PoseLandmarker(33 点身体) → 肩/肘/腕/髋坐标
//   → 算左右「上举角」(上臂向量 vs 躯干竖直) → EMA 平滑 → 输出快照。
//
// 上举角定义:上臂向量(肩→腕)与「躯干竖直向下」的夹角。
//   手臂自然垂放 ≈ 0°,侧平举 ≈ 90°,上举过头 ≈ 180°。
//
// 隐私红线:只处理坐标/角度数值,绝不缓存、上传、导出画面帧。
//   stopCamera() 提供「测评结束立即释放摄像头」。
//
// 模型:pose_landmarker_lite(CDN 同 you-facecam.js 已验证地址)。
// 与 FaceLandmarker 不同页共存(颈/眼用 pose-kernel 的 Face,肩用本内核的 Pose,分步切换)。
// ============================================================

import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

export const BODY_KERNEL_VERSION = '1.0.0';

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// 33 点关键索引
const L = { shoulder: 11, elbow: 13, wrist: 15, hip: 23 };
const R = { shoulder: 12, elbow: 14, wrist: 16, hip: 24 };

function vis(p) { return p && (p.visibility == null ? 1 : p.visibility); }

// 上举角(度):上臂向量(肩→腕)与躯干竖直向下向量的夹角。
// 图像坐标 y 向下,「向下」= (0, +1)。手垂放两向量同向→0°;举过头→反向→180°。
function elevationAngle(shoulder, wrist) {
  if (!shoulder || !wrist) return null;
  const ax = wrist.x - shoulder.x, ay = wrist.y - shoulder.y;
  const mag = Math.hypot(ax, ay);
  if (mag < 1e-4) return 0;
  // 与 (0,1) 的夹角:cosθ = ay / mag
  const cos = Math.max(-1, Math.min(1, ay / mag));
  return Math.acos(cos) * 180 / Math.PI;
}

export function createPoseBodyKernel(opts = {}) {
  const video = opts.video;
  const SMOOTH = opts.smooth ?? 0.3;

  let poseLandmarker = null;
  let stream = null;
  let lastVideoTime = -1;
  let latest = null;              // 最新一帧 33 landmarks
  let smoothElev = { left: 0, right: 0 };
  let present = false;

  function pt(lm, i) { const p = lm && lm[i]; return (p && vis(p) >= 0.3) ? { x: p.x, y: p.y } : null; }

  function computeElev(lm) {
    const shL = pt(lm, L.shoulder), wrL = pt(lm, L.wrist);
    const shR = pt(lm, R.shoulder), wrR = pt(lm, R.wrist);
    return {
      left: elevationAngle(shL, wrL),
      right: elevationAngle(shR, wrR),
    };
  }

  return {
    version: BODY_KERNEL_VERSION,

    async loadModel(onStatus) {
      if (onStatus) onStatus('正在唤醒 Joy…(首次约需几秒)');
      const resolver = await FilesetResolver.forVisionTasks(WASM_URL);
      poseLandmarker = await PoseLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO", numPoses: 1,
      });
      if (onStatus) onStatus('');
      return poseLandmarker;
    },

    async startCamera() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      await new Promise(res => { if (video.readyState >= 2) res(); else video.onloadeddata = () => res(); });
    },

    stopCamera() {
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      if (video) video.srcObject = null;
    },

    ready() { return !!poseLandmarker && video && video.readyState >= 2; },

    // 每帧驱动:detect + 平滑。返回快照或 null(未就绪)。
    tick(now) {
      if (!poseLandmarker || !video || video.readyState < 2) return null;
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        let res = null;
        try { res = poseLandmarker.detectForVideo(video, now); } catch {}
        if (res && res.landmarks && res.landmarks.length > 0) {
          latest = res.landmarks[0];
          present = true;
        } else { latest = null; present = false; }
      }
      const raw = latest ? computeElev(latest) : { left: null, right: null };
      // EMA 平滑(null 时保持上次值)
      if (raw.left != null) smoothElev.left += (raw.left - smoothElev.left) * SMOOTH;
      if (raw.right != null) smoothElev.right += (raw.right - smoothElev.right) * SMOOTH;
      return {
        present,
        elevation: { ...smoothElev },
        elevationMax: Math.max(smoothElev.left, smoothElev.right),
        landmarks: latest,
      };
    },

    snapshot() {
      return { present, elevation: { ...smoothElev }, elevationMax: Math.max(smoothElev.left, smoothElev.right) };
    },
  };
}

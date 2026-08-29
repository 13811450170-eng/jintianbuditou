"""MaixCAM real-time squat coach MVP.

Runs YOLO11-Pose locally, evaluates motion locally, and sends only structured
events/session summaries to the companion app. No camera frames leave device.
Copy config.example.json to /root/maixcoach.json and edit gateway/token first.
"""

import json
import math
import socket
import time as pytime

from maix import app, camera, display, image, nn

CONFIG_PATH = "/root/maixcoach.json"
DEFAULT_CONFIG = {
    "device_id": "maixcam-desk-01",
    "device_name": "Joy 工位教练",
    "gateway_host": "192.168.1.100",
    "gateway_port": 3180,
    "device_token": "change-me",
    "model": "/root/models/yolo11n_pose.mud",
}


def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    except Exception:
        return DEFAULT_CONFIG.copy()


def post_json(cfg, path, payload):
    """Tiny dependency-free HTTP client suitable for the MaixPy Linux image."""
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = (
        "POST %s HTTP/1.1\r\nHost: %s\r\nContent-Type: application/json\r\n"
        "X-Device-Token: %s\r\nContent-Length: %d\r\nConnection: close\r\n\r\n"
        % (path, cfg["gateway_host"], cfg["device_token"], len(body))
    ).encode("utf-8") + body
    sock = socket.socket()
    try:
        sock.settimeout(1.0)
        sock.connect((cfg["gateway_host"], int(cfg["gateway_port"])))
        sock.sendall(request)
        response = sock.recv(96)
        return b" 200 " in response
    except Exception:
        return False
    finally:
        sock.close()


def point(points, index):
    offset = index * 2
    if offset + 1 >= len(points):
        return None
    x, y = points[offset], points[offset + 1]
    return None if x < 0 or y < 0 else (float(x), float(y))


def angle(a, b, c):
    if not a or not b or not c:
        return None
    ba = (a[0] - b[0], a[1] - b[1])
    bc = (c[0] - b[0], c[1] - b[1])
    denom = math.hypot(*ba) * math.hypot(*bc)
    if denom < 1e-6:
        return None
    cosine = max(-1.0, min(1.0, (ba[0] * bc[0] + ba[1] * bc[1]) / denom))
    return math.degrees(math.acos(cosine))


def average(values):
    usable = [v for v in values if v is not None]
    return sum(usable) / len(usable) if usable else None


class SquatCoach:
    STANDING_ANGLE = 155
    DOWN_ANGLE = 125
    BOTTOM_ANGLE = 105

    def __init__(self, cfg):
        self.cfg = cfg
        self.session_id = "%s-%d" % (cfg["device_id"], int(pytime.time()))
        self.started_at = int(pytime.time() * 1000)
        self.state = "standing"
        self.reps = 0
        self.valid_reps = 0
        self.warning_counts = {}
        self.last_cue = "站到镜头前，让我看到你的全身"
        self.last_emit = {}
        self.last_heartbeat = 0
        self.bottom_reached = False
        self.angles = []

    def base(self):
        return {
            "deviceId": self.cfg["device_id"],
            "name": self.cfg["device_name"],
            "model": "MaixCAM",
            "firmware": "maixcoach-mvp-1",
            "capabilities": ["pose17", "squat", "realtime_feedback"],
        }

    def heartbeat(self):
        now = pytime.time()
        if now - self.last_heartbeat >= 5:
            post_json(self.cfg, "/device/v1/heartbeat", self.base())
            self.last_heartbeat = now

    def emit(self, event_type, cue, severity="info", metrics=None, cooldown=1.8):
        now = pytime.time()
        if now - self.last_emit.get(event_type, 0) < cooldown:
            return
        self.last_emit[event_type] = now
        self.last_cue = cue
        if severity in ("warning", "stop"):
            self.warning_counts[event_type] = self.warning_counts.get(event_type, 0) + 1
        payload = {
            **self.base(), "sessionId": self.session_id, "ts": int(now * 1000),
            "type": event_type, "exercise": "squat", "severity": severity,
            "cue": cue, "metrics": metrics or {}, "quality": {},
        }
        post_json(self.cfg, "/device/v1/events", payload)

    def update(self, points):
        # COCO pose indices: shoulders 5/6, hips 11/12, knees 13/14, ankles 15/16.
        left_knee = angle(point(points, 11), point(points, 13), point(points, 15))
        right_knee = angle(point(points, 12), point(points, 14), point(points, 16))
        knee = average([left_knee, right_knee])
        if knee is None:
            self.emit("BODY_NOT_VISIBLE", "请往后站一点，让我看到髋、膝和脚踝", "warning", cooldown=3)
            return
        self.angles.append(knee)
        self.angles = self.angles[-30:]

        metrics = {"kneeAngle": round(knee, 1), "reps": self.reps, "validReps": self.valid_reps}
        if self.state == "standing" and knee < self.DOWN_ANGLE:
            self.state = "down"
            self.bottom_reached = knee <= self.BOTTOM_ANGLE
        elif self.state == "down":
            if knee <= self.BOTTOM_ANGLE:
                self.bottom_reached = True
                self.emit("BOTTOM_OK", "深度很好，稳一下再起身", "good", metrics, cooldown=2.5)
            elif knee > self.STANDING_ANGLE:
                self.reps += 1
                if self.bottom_reached:
                    self.valid_reps += 1
                    self.emit("GOOD_REP", "很好，第 %d 个" % self.valid_reps, "good", metrics, cooldown=0)
                else:
                    self.emit("TOO_SHALLOW", "这次稍浅，下一个再蹲深一点", "warning", metrics, cooldown=0)
                self.state = "standing"
                self.bottom_reached = False

    def finish(self):
        duration = int(pytime.time() * 1000) - self.started_at
        metrics = {
            "reps": self.reps,
            "validReps": self.valid_reps,
            "depthScore": round(100 * self.valid_reps / max(1, self.reps)),
            "kneeAngleAvg": round(average(self.angles) or 0, 1),
        }
        events = [{"type": key, "count": count} for key, count in self.warning_counts.items()]
        post_json(self.cfg, "/device/v1/sessions", {
            **self.base(), "sessionId": self.session_id, "exercise": "squat",
            "startedAt": self.started_at, "endedAt": int(pytime.time() * 1000),
            "durationMs": duration, "metrics": metrics, "quality": {}, "events": events,
        })


def main():
    cfg = load_config()
    detector = nn.YOLO11(model=cfg["model"], dual_buff=True)
    cam = camera.Camera(detector.input_width(), detector.input_height(), detector.input_format())
    disp = display.Display()
    coach = SquatCoach(cfg)
    post_json(cfg, "/device/v1/register", coach.base())

    try:
        while not app.need_exit():
            coach.heartbeat()
            img = cam.read()
            objects = detector.detect(img, conf_th=0.5, iou_th=0.45, keypoint_th=0.45)
            people = [obj for obj in objects if len(obj.points) >= 34]
            if people:
                person = max(people, key=lambda obj: obj.w * obj.h)
                coach.update(person.points)
                detector.draw_pose(img, person.points, 4, image.COLOR_GREEN)
            else:
                coach.emit("PERSON_MISSING", "我没看到你，站到镜头前吧", "warning", cooldown=3)
            img.draw_string(10, 10, "Squat %d" % coach.valid_reps, color=image.COLOR_WHITE)
            img.draw_string(10, 38, coach.last_cue, color=image.COLOR_YELLOW)
            disp.show(img)
    finally:
        coach.finish()


main()

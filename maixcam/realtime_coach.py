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
    "gateway_timeout_ms": 250,
}


def load_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    except Exception:
        return DEFAULT_CONFIG.copy()


def request_json(cfg, path, payload):
    """Tiny dependency-free HTTP client suitable for the MaixPy Linux image."""
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = (
        "POST %s HTTP/1.1\r\nHost: %s\r\nContent-Type: application/json\r\n"
        "X-Device-Token: %s\r\nContent-Length: %d\r\nConnection: close\r\n\r\n"
        % (path, cfg["gateway_host"], cfg["device_token"], len(body))
    ).encode("utf-8") + body
    sock = socket.socket()
    try:
        # Network feedback must never stall the local real-time coaching loop.
        sock.settimeout(max(0.05, float(cfg.get("gateway_timeout_ms", 250)) / 1000.0))
        sock.connect((cfg["gateway_host"], int(cfg["gateway_port"])))
        sock.sendall(request)
        chunks = []
        while True:
            chunk = sock.recv(1024)
            if not chunk:
                break
            chunks.append(chunk)
        response = b"".join(chunks)
        if b" 200 " not in response:
            return None
        _, _, raw_body = response.partition(b"\r\n\r\n")
        return json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        return None
    finally:
        sock.close()


def post_json(cfg, path, payload):
    return request_json(cfg, path, payload) is not None


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
        self.connected = False
        self.active = False
        self.paused = False
        self.current_set = 0
        self.total_sets = 3
        self.target_reps = 10
        self.set_valid_reps = 0
        self.last_command_poll = 0
        self.session_finished = False

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
            self.connected = post_json(self.cfg, "/device/v1/heartbeat", self.base())
            self.last_heartbeat = now

    def poll_command(self):
        now = pytime.time()
        if now - self.last_command_poll < 0.8:
            return
        self.last_command_poll = now
        response = request_json(self.cfg, "/device/v1/commands/poll", self.base())
        self.connected = response is not None
        command = response.get("command") if response else None
        if command:
            self.apply_command(command)

    def apply_command(self, command):
        kind = command.get("type", "")
        payload = command.get("payload") or {}
        if kind == "CALIBRATE":
            self.active = False
            self.paused = False
            self.last_cue = "站到镜头前，让我看到你的全身"
        elif kind == "START_SESSION":
            self.session_id = payload.get("sessionId") or "%s-%d" % (self.cfg["device_id"], int(pytime.time()))
            self.started_at = int(pytime.time() * 1000)
            self.reps = self.valid_reps = self.set_valid_reps = 0
            self.warning_counts = {}
            self.session_finished = False
            self.total_sets = int(payload.get("totalSets") or 3)
            self.target_reps = int(payload.get("targetReps") or 10)
            self.emit("SESSION_READY", "训练计划已收到，准备开始", "info", cooldown=0)
        elif kind == "START_SET":
            self.current_set = int(payload.get("set") or 1)
            self.total_sets = int(payload.get("totalSets") or self.total_sets)
            self.target_reps = int(payload.get("targetReps") or self.target_reps)
            self.set_valid_reps = 0
            self.state = "standing"
            self.bottom_reached = False
            self.paused = False
            self.active = True
            self.emit("SET_STARTED", "第 %d 组开始" % self.current_set, "info", {
                "set": self.current_set, "totalSets": self.total_sets, "targetReps": self.target_reps,
            }, cooldown=0)
        elif kind == "PAUSE":
            self.paused = True
            self.last_cue = "训练已暂停"
        elif kind == "RESUME":
            self.paused = False
            self.last_cue = "继续训练"
        elif kind == "STOP":
            self.active = False
            self.paused = False
            self.finish()

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

        metrics = {"kneeAngle": round(knee, 1), "reps": self.reps, "validReps": self.valid_reps,
                   "setValidReps": self.set_valid_reps, "set": self.current_set}
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
                    self.set_valid_reps += 1
                    self.emit("GOOD_REP", "很好，第 %d 个" % self.valid_reps, "good", metrics, cooldown=0)
                else:
                    self.emit("TOO_SHALLOW", "这次稍浅，下一个再蹲深一点", "warning", metrics, cooldown=0)
                self.state = "standing"
                self.bottom_reached = False
                if self.active and self.set_valid_reps >= self.target_reps:
                    self.active = False
                    self.emit("SET_COMPLETE", "第 %d 组完成，休息一下" % self.current_set, "good", {
                        "set": self.current_set, "totalSets": self.total_sets,
                        "setValidReps": self.set_valid_reps, "validReps": self.valid_reps,
                    }, cooldown=0)

    def finish(self):
        if self.session_finished:
            return
        self.session_finished = True
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
    coach.connected = post_json(cfg, "/device/v1/register", coach.base())

    try:
        while not app.need_exit():
            coach.heartbeat()
            coach.poll_command()
            img = cam.read()
            objects = detector.detect(img, conf_th=0.5, iou_th=0.45, keypoint_th=0.45)
            people = [obj for obj in objects if len(obj.points) >= 34]
            if people and coach.active and not coach.paused:
                person = max(people, key=lambda obj: obj.w * obj.h)
                coach.update(person.points)
                detector.draw_pose(img, person.points, 4, image.COLOR_GREEN)
            elif not people and coach.active:
                coach.emit("PERSON_MISSING", "我没看到你，站到镜头前吧", "warning", cooldown=3)
            elif people:
                person = max(people, key=lambda obj: obj.w * obj.h)
                detector.draw_pose(img, person.points, 4, image.COLOR_GREEN)
                if not coach.active and not coach.paused:
                    coach.last_cue = "准备就绪，等待网页开始训练"
            img.draw_string(10, 10, "Set %d/%d  %d/%d" % (
                coach.current_set, coach.total_sets, coach.set_valid_reps, coach.target_reps), color=image.COLOR_WHITE)
            img.draw_string(10, 38, coach.last_cue, color=image.COLOR_YELLOW)
            status = "Gateway ONLINE" if coach.connected else "Gateway OFFLINE"
            status_color = image.COLOR_GREEN if coach.connected else image.COLOR_RED
            img.draw_string(10, 66, status, color=status_color)
            disp.show(img)
    finally:
        coach.finish()
        cam.close()


if __name__ == "__main__":
    main()

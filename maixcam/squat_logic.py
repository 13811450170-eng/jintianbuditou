"""Dependency-free squat motion state machine for MaixCAM and desktop tests."""


def median(values):
    ordered = sorted(values)
    if not ordered:
        return None
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2.0


def select_knee_angle(left, right, previous=None, max_pair_delta=30):
    usable = [value for value in (left, right) if value is not None]
    if not usable:
        return None
    if len(usable) == 1:
        return usable[0]
    if abs(left - right) <= max_pair_delta:
        return (left + right) / 2.0
    if previous is not None:
        return min(usable, key=lambda value: abs(value - previous))
    # The more open side is usually less affected by foreshortening on an oblique camera.
    return max(usable)


class SquatMotionTracker:
    """Smooth pose angles, calibrate the user, and emit one result per full cycle."""

    def __init__(self, window=5, confirm_frames=3, calibration_frames=12, missing_reset_frames=5):
        self.window = window
        self.confirm_frames = confirm_frames
        self.calibration_frames = calibration_frames
        self.missing_reset_frames = missing_reset_frames
        self.reset()

    def reset(self):
        self.state = "calibrating"
        self.filtered = None
        self.samples = []
        self.calibration = []
        self.counters = {}
        self.bottom_reached = False
        self.missing_frames = 0
        self.standing_angle = 165.0
        self.down_angle = 125.0
        self.bottom_angle = 105.0

    def _confirmed(self, key, condition, frames=None):
        if not condition:
            self.counters[key] = 0
            return False
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key] >= (frames or self.confirm_frames)

    def _clear_counters(self):
        self.counters = {}

    def missing(self):
        self.missing_frames += 1
        if self.missing_frames < self.missing_reset_frames:
            return False
        # Never complete an action that was interrupted by lost keypoints/person.
        if self.state != "calibrating":
            self.state = "standing"
        self.bottom_reached = False
        self.samples = []
        self.filtered = None
        self._clear_counters()
        return True

    def update(self, left, right):
        raw = select_knee_angle(left, right, self.filtered)
        if raw is None:
            self.missing()
            return {"visible": False, "knee": None, "state": self.state}

        self.missing_frames = 0
        self.samples.append(float(raw))
        self.samples = self.samples[-self.window:]
        self.filtered = median(self.samples)
        result = {"visible": True, "knee": self.filtered, "state": self.state,
                  "calibrated": False, "bottom": False, "rep": None}

        if self.state == "calibrating":
            # Ignore crouched/noisy frames until a stable upright pose is visible.
            if self.filtered >= 145:
                self.calibration.append(self.filtered)
            else:
                self.calibration = []
            if len(self.calibration) >= self.calibration_frames:
                self.standing_angle = max(155.0, min(178.0, median(self.calibration)))
                self.down_angle = max(115.0, self.standing_angle - 42.0)
                self.bottom_angle = max(90.0, self.standing_angle - 62.0)
                self.state = "standing"
                self._clear_counters()
                result["calibrated"] = True
            result["state"] = self.state
            return result

        if self.state == "standing":
            if self._confirmed("going_down", self.filtered < self.down_angle):
                self.state = "down"
                self.bottom_reached = self.filtered <= self.bottom_angle
                self._clear_counters()
        elif self.state == "down":
            if self._confirmed("at_bottom", self.filtered <= self.bottom_angle, 2):
                if not self.bottom_reached:
                    result["bottom"] = True
                self.bottom_reached = True
            if self._confirmed("standing_up", self.filtered >= self.standing_angle - 10.0):
                result["rep"] = "valid" if self.bottom_reached else "shallow"
                self.state = "standing"
                self.bottom_reached = False
                self._clear_counters()

        result["state"] = self.state
        return result

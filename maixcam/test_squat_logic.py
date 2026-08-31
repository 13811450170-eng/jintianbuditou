import unittest

from squat_logic import SquatMotionTracker, select_knee_angle


def frames(value, count):
    return [(value, value)] * count


class SquatMotionTrackerTest(unittest.TestCase):
    def tracker(self):
        tracker = SquatMotionTracker(window=3, confirm_frames=2, calibration_frames=4, missing_reset_frames=3)
        for left, right in frames(170, 6):
            tracker.update(left, right)
        self.assertEqual(tracker.state, "standing")
        return tracker

    def test_full_squat_emits_exactly_one_valid_rep(self):
        tracker = self.tracker()
        results = []
        sequence = frames(120, 4) + frames(100, 4) + frames(170, 5)
        for left, right in sequence:
            results.append(tracker.update(left, right)["rep"])
        self.assertEqual(results.count("valid"), 1)

    def test_jitter_does_not_start_or_double_count(self):
        tracker = self.tracker()
        results = [tracker.update(value, value)["rep"] for value in (130, 126, 132, 124, 130, 128, 170)]
        self.assertEqual([result for result in results if result], [])

    def test_shallow_cycle_is_reported_but_not_valid(self):
        tracker = self.tracker()
        results = []
        for left, right in frames(120, 4) + frames(118, 2) + frames(170, 5):
            results.append(tracker.update(left, right)["rep"])
        self.assertEqual(results.count("shallow"), 1)
        self.assertEqual(results.count("valid"), 0)

    def test_missing_person_cancels_incomplete_rep(self):
        tracker = self.tracker()
        for value in (120, 118, 100, 98):
            tracker.update(value, value)
        for _ in range(3):
            tracker.missing()
        results = [tracker.update(170, 170)["rep"] for _ in range(4)]
        self.assertEqual([result for result in results if result], [])

    def test_uses_stable_side_when_other_side_jumps(self):
        self.assertEqual(select_knee_angle(120, 175, previous=122), 120)
        self.assertEqual(select_knee_angle(None, 150, previous=120), 150)


if __name__ == "__main__":
    unittest.main()

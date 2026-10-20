import numpy as np
import logging

logger = logging.getLogger(__name__)

class VehicleCounter:
    """
    Vehicle Counter and Direction Analyzer.
    Maintains centroid history and tracks line crossing to accurately count unique vehicles
    and classify movement direction without double-counting.
    """

    def __init__(self, line_coords, direction_a_name="Inbound", direction_b_name="Outbound"):
        """
        line_coords: ((x1, y1), (x2, y2)) absolute pixel coordinates of counting line.
        """
        self.line_start = np.array(line_coords[0], dtype=np.float32)
        self.line_end = np.array(line_coords[1], dtype=np.float32)
        self.dir_a_name = direction_a_name
        self.dir_b_name = direction_b_name

        self.counted_ids = set()
        self.counted_id_classes = {} # track_id -> class_name
        self.centroid_history = {} # track_id -> list of (x, y) centroids

        self.counts = {
            'total': 0,
            'car': 0,
            'motorcycle': 0,
            'bus': 0,
            'truck': 0,
            'direction_a': 0,
            'direction_b': 0
        }

    def _intersect(self, p1, p2):
        """
        Check if line segment p1->p2 intersects counting line line_start->line_end.
        """
        def ccw(A, B, C):
            return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])

        A = self.line_start
        B = self.line_end
        C = np.array(p1, dtype=np.float32)
        D = np.array(p2, dtype=np.float32)

        return ccw(A,C,D) != ccw(B,C,D) and ccw(A,B,C) != ccw(A,B,D)

    def process_tracked_objects(self, tracked_objects):
        """
        Process current frame's tracked objects.
        Updates centroid history, detects line crossings, and updates vehicle counts.
        """
        for obj in tracked_objects:
            t_id = obj['track_id']
            curr_pos = obj['centroid']
            cls_name = obj['class_name']

            if t_id not in self.centroid_history:
                self.centroid_history[t_id] = [curr_pos]
            else:
                self.centroid_history[t_id].append(curr_pos)
                if len(self.centroid_history[t_id]) > 30:
                    self.centroid_history[t_id].pop(0)

            # If vehicle has not been counted yet and has history
            if t_id not in self.counted_ids and len(self.centroid_history[t_id]) >= 2:
                prev_pos = self.centroid_history[t_id][-2]

                if self._intersect(prev_pos, curr_pos):
                    self.counted_ids.add(t_id)
                    self.counted_id_classes[t_id] = cls_name
                    obj['crossed_counting_line'] = True

                    # Increment totals
                    self.counts['total'] += 1
                    target_key = cls_name if cls_name in self.counts else 'car'
                    self.counts[target_key] += 1

                    # Determine Direction: Vector cross product with counting line vector
                    line_vector = self.line_end - self.line_start
                    move_vector = np.array(curr_pos) - np.array(prev_pos)
                    cross_prod = line_vector[0] * move_vector[1] - line_vector[1] * move_vector[0]

                    if cross_prod >= 0:
                        self.counts['direction_a'] += 1
                        obj['direction'] = self.dir_a_name
                    else:
                        self.counts['direction_b'] += 1
                        obj['direction'] = self.dir_b_name
                else:
                    obj['crossed_counting_line'] = False
            else:
                obj['crossed_counting_line'] = t_id in self.counted_ids

        return tracked_objects

    def get_counts(self):
        return dict(self.counts)

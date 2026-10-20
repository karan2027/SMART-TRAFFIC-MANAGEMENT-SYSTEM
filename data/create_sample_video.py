import os
import cv2
import numpy as np

def generate_sample_traffic_video(output_path="data/videos/traffic_road_01.mp4", duration_seconds=12, fps=30):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    width, height = 1280, 720
    total_frames = duration_seconds * fps

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # Define vehicle simulation profiles with detailed vehicle shapes
    vehicles = [
        {'id': 101, 'type': 'car', 'lane': 0, 'speed': 9, 'y': -100, 'body_color': (220, 60, 60), 'size': (80, 150)},
        {'id': 102, 'type': 'car', 'lane': 1, 'speed': 12, 'y': -350, 'body_color': (40, 180, 220), 'size': (75, 140)},
        {'id': 103, 'type': 'truck', 'lane': 2, 'speed': 7, 'y': -200, 'body_color': (60, 60, 220), 'size': (95, 240)},
        {'id': 104, 'type': 'bus', 'lane': 0, 'speed': 8, 'y': -650, 'body_color': (220, 180, 40), 'size': (100, 260)},
        {'id': 105, 'type': 'motorcycle', 'lane': 1, 'speed': 15, 'y': -500, 'body_color': (200, 40, 200), 'size': (45, 85)},
        {'id': 106, 'type': 'car', 'lane': 2, 'speed': 10, 'y': -800, 'body_color': (220, 220, 220), 'size': (80, 145)},
    ]

    lane_x = [320, 580, 840] # Lane center coordinates

    print(f"Generating realistic sample traffic video: {output_path} ({width}x{height}, {fps} FPS, {duration_seconds}s)...")

    for frame_idx in range(total_frames):
        # Asphalt road surface
        frame = np.full((height, width, 3), (45, 45, 45), dtype=np.uint8)

        # Grass borders
        cv2.rectangle(frame, (0, 0), (180, height), (35, 85, 35), -1)
        cv2.rectangle(frame, (980, 0), (width, height), (35, 85, 35), -1)

        # Road shoulder solid white lines
        cv2.line(frame, (180, 0), (180, height), (240, 240, 240), 4)
        cv2.line(frame, (980, 0), (980, height), (240, 240, 240), 4)

        # White dashed lane dividers (Fixed CCTV Perspective)
        dash_len, gap = 45, 35
        for divider_x in [450, 710]:
            for y in range(0, height, dash_len + gap):
                cv2.rectangle(frame, (divider_x - 3, y), (divider_x + 3, y + dash_len), (230, 230, 230), -1)

        # Render moving vehicles with windshields, lights, wheels
        for v in vehicles:
            v['y'] += v['speed']
            if v['y'] > height + 250:
                v['y'] = -180 - ((frame_idx * 17) % 200)

            vx = lane_x[v['lane']]
            vy = int(v['y'])
            vw, vh = v['size']

            top_left = (vx - vw // 2, vy - vh // 2)
            bottom_right = (vx + vw // 2, vy + vh // 2)

            # Main Body
            cv2.rectangle(frame, top_left, bottom_right, v['body_color'], -1)
            cv2.rectangle(frame, top_left, bottom_right, (10, 10, 10), 2)

            # Front & Rear Windshields
            fw_tl = (vx - int(vw * 0.38), vy - int(vh * 0.35))
            fw_br = (vx + int(vw * 0.38), vy - int(vh * 0.15))
            cv2.rectangle(frame, fw_tl, fw_br, (40, 40, 40), -1) # Front windshield

            rw_tl = (vx - int(vw * 0.38), vy + int(vh * 0.15))
            rw_br = (vx + int(vw * 0.38), vy + int(vh * 0.35))
            cv2.rectangle(frame, rw_tl, rw_br, (30, 30, 30), -1) # Rear windshield

            # Headlights (bottom front)
            cv2.circle(frame, (vx - int(vw*0.35), vy + int(vh*0.45)), 6, (0, 255, 255), -1)
            cv2.circle(frame, (vx + int(vw*0.35), vy + int(vh*0.45)), 6, (0, 255, 255), -1)

            # Tail lights (top rear)
            cv2.circle(frame, (vx - int(vw*0.35), vy - int(vh*0.45)), 5, (0, 0, 255), -1)
            cv2.circle(frame, (vx + int(vw*0.35), vy - int(vh*0.45)), 5, (0, 0, 255), -1)

        out.write(frame)

    out.release()
    print(f"Sample traffic video successfully generated at: {output_path}")

if __name__ == "__main__":
    generate_sample_traffic_video("data/videos/traffic_road_01.mp4", duration_seconds=12, fps=30)

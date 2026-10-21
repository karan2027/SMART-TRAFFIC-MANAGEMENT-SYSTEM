import matplotlib.pyplot as plt
import matplotlib.patches as patches
import os

def create_system_architecture_diagram(output_png, output_svg):
    # Set high resolution figure (16:10 ratio, 300 DPI)
    fig, ax = plt.subplots(figsize=(16, 11), dpi=300)
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')

    # Remove axes
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Colors
    c_slate_dark = '#0F172A'
    c_slate_border = '#CBD5E1'
    c_blue_primary = '#1E40AF'
    c_blue_light = '#EFF6FF'
    c_blue_border = '#3B82F6'
    
    c_purple_bg = '#FAF5FF'
    c_purple_border = '#A855F7'
    c_purple_title = '#6B21A8'
    
    c_emerald_bg = '#F0FDF4'
    c_emerald_border = '#22C55E'
    c_emerald_title = '#15803D'

    c_amber_bg = '#FFFBEB'
    c_amber_border = '#F59E0B'
    c_amber_title = '#B45309'

    c_cyan_bg = '#ECFEFF'
    c_cyan_border = '#06B6D4'
    c_cyan_title = '#0E7490'

    # Title & Subtitle Banner
    ax.text(50, 96.5, "SYSTEM ARCHITECTURE DIAGRAM", 
            ha='center', va='center', fontsize=20, fontweight='bold', color=c_slate_dark, family='sans-serif')
    ax.text(50, 93.8, "Intelligent Traffic Management System (ITMS) — Multi-Tier End-to-End Pipeline", 
            ha='center', va='center', fontsize=11, color='#64748B', family='sans-serif')

    def draw_box(x, y, w, h, bg_color, border_color, radius=1.0, linewidth=1.5):
        box = patches.FancyBboxPatch((x, y), w, h,
                                     boxstyle=f"round,pad=0.3,rounding_size={radius}",
                                     facecolor=bg_color, edgecolor=border_color,
                                     linewidth=linewidth, zorder=2)
        ax.add_patch(box)
        return box

    def draw_arrow(x1, y1, x2, y2, label="", color='#475569', rad=0.0):
        connectionstyle = f"arc3,rad={rad}" if rad != 0.0 else "arc3,rad=0"
        arrow = patches.FancyArrowPatch((x1, y1), (x2, y2),
                                        connectionstyle=connectionstyle,
                                        arrowstyle='-|>,head_length=6,head_width=4',
                                        color=color, linewidth=1.8, zorder=5)
        ax.add_patch(arrow)
        if label:
            mx = (x1 + x2) / 2
            my = (y1 + y2) / 2
            ax.text(mx + 1.2, my, label, ha='left', va='center', fontsize=8,
                    fontweight='bold', color=color, zorder=6,
                    bbox=dict(boxstyle='square,pad=0.2', facecolor='#F8FAFC', edgecolor='none', alpha=0.9))

    # =========================================================================
    # TIER 1: INPUT & DATA ACQUISITION LAYER (Top Left / Stream)
    # =========================================================================
    draw_box(4, 73, 92, 17, '#FFFFFF', '#94A3B8', radius=1.5, linewidth=1.8)
    ax.text(6, 88, "LAYER 1: INPUT & VIDEO ACQUISITION LAYER", fontsize=11, fontweight='bold', color='#1E293B')

    # Sub-components in Layer 1
    # 1. Video Sources
    draw_box(6, 75, 26, 11, c_blue_light, c_blue_border)
    ax.text(19, 83.5, "Traffic Video Ingestion", ha='center', va='center', fontsize=10, fontweight='bold', color=c_blue_primary)
    ax.text(19, 80, "• Recorded CCTV (.mp4, .avi, .mov)\n• Synthetic Traffic Generator\n• Future: RTSP / IP Camera Feeds", 
            ha='center', va='center', fontsize=7.5, color='#334155')

    # 2. OpenCV Preprocessor
    draw_box(37, 75, 26, 11, c_cyan_bg, c_cyan_border)
    ax.text(50, 83.5, "OpenCV Preprocessing", ha='center', va='center', fontsize=10, fontweight='bold', color=c_cyan_title)
    ax.text(50, 80, "• 30 FPS Frame Extraction\n• Frame Resize & Normalization\n• Polygonal ROI Spatial Masking", 
            ha='center', va='center', fontsize=7.5, color='#334155')

    # 3. Parameter Config
    draw_box(68, 75, 26, 11, '#F1F5F9', '#94A3B8')
    ax.text(81, 83.5, "Camera & Road Config", ha='center', va='center', fontsize=10, fontweight='bold', color='#334155')
    ax.text(81, 80, "• Road IDs & Lane Geometry\n• Camera Resolution & FPS\n• Virtual Line Coordinates (P1, P2)", 
            ha='center', va='center', fontsize=7.5, color='#334155')

    draw_arrow(32, 80.5, 37, 80.5)
    draw_arrow(68, 80.5, 63, 80.5)

    # Down arrow to AI Layer
    draw_arrow(50, 73, 50, 68, "Raw Video Frames (RGB)", color=c_blue_border)

    # =========================================================================
    # TIER 2: AI COMPUTER VISION & PERCEPTION ENGINE (Python 3.13 / FastAPI)
    # =========================================================================
    draw_box(4, 38, 92, 29, '#FFFFFF', c_purple_border, radius=1.5, linewidth=2.0)
    ax.text(6, 65, "LAYER 2: AI PERCEPTION & COMPUTER VISION ENGINE (Python, PyTorch, YOLOv8)", 
            fontsize=11, fontweight='bold', color=c_purple_title)

    # Modules inside AI Engine
    # 2.1 YOLOv8 Detection
    draw_box(6, 50, 20, 12, c_purple_bg, c_purple_border)
    ax.text(16, 59.5, "YOLOv8 Detection", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_purple_title)
    ax.text(16, 54.5, "• Deep Learning Model\n• Car, Motorbike, Bus, Truck\n• Bounding Box Inference\n• Confidence Thresholding", 
            ha='center', va='center', fontsize=7, color='#334155')

    # 2.2 ByteTrack
    draw_box(29, 50, 20, 12, c_purple_bg, c_purple_border)
    ax.text(39, 59.5, "ByteTrack Tracking", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_purple_title)
    ax.text(39, 54.5, "• Multi-Object Association\n• Kalman Filter Prediction\n• Hungarian Track Matching\n• Unique Track ID Assignment", 
            ha='center', va='center', fontsize=7, color='#334155')

    # 2.3 Tripwire Counting & Direction
    draw_box(52, 50, 20, 12, c_purple_bg, c_purple_border)
    ax.text(62, 59.5, "Line Crossing Engine", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_purple_title)
    ax.text(62, 54.5, "• Virtual Line Intersection\n• 2D Vector Cross Product\n• Direction A vs B Classify\n• Duplicate-Proof Counting", 
            ha='center', va='center', fontsize=7, color='#334155')

    # 2.4 Speed & Density Analytics
    draw_box(75, 50, 20, 12, c_purple_bg, c_purple_border)
    ax.text(85, 59.5, "Speed & Congestion", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_purple_title)
    ax.text(85, 54.5, "• 2-Point Calibrated Speed\n• Velocity in km/h\n• ROI Occupancy Density %\n• Congestion State Rules", 
            ha='center', va='center', fontsize=7, color='#334155')

    # Connecting pipeline arrows inside Layer 2
    draw_arrow(26, 56, 29, 56)
    draw_arrow(49, 56, 52, 56)
    draw_arrow(72, 56, 75, 56)

    # AI Engine Outputs (Bottom row of Layer 2)
    draw_box(16, 40, 32, 7.5, '#FAF5FF', '#C084FC')
    ax.text(32, 43.8, "Annotated Video Generator (OpenCV VideoWriter)", ha='center', va='center', fontsize=8, fontweight='bold', color='#581C87')
    ax.text(32, 41.5, "Draws bounding boxes, track IDs, speed HUD & virtual tripwire", ha='center', va='center', fontsize=6.5, color='#4A044E')

    draw_box(53, 40, 32, 7.5, '#FAF5FF', '#C084FC')
    ax.text(69, 43.8, "Structured Telemetry & Summary Generator", ha='center', va='center', fontsize=8, fontweight='bold', color='#581C87')
    ax.text(69, 41.5, "Produces structured JSON logs & frame-by-frame statistics", ha='center', va='center', fontsize=6.5, color='#4A044E')

    draw_arrow(32, 50, 32, 47.5)
    draw_arrow(69, 50, 69, 47.5)

    # Down arrow to Backend Layer
    draw_arrow(69, 38, 69, 33, "REST JSON Payload / Webhook Callback", color='#7C3AED')

    # =========================================================================
    # TIER 3: BACKEND REST API & PERSISTENCE LAYER (Node.js / Express / MongoDB)
    # =========================================================================
    draw_box(4, 18, 92, 14.5, '#FFFFFF', c_emerald_border, radius=1.5, linewidth=2.0)
    ax.text(6, 31, "LAYER 3: BACKEND SERVICE & DATA PERSISTENCE LAYER (Node.js, Express, MongoDB)", 
            fontsize=11, fontweight='bold', color=c_emerald_title)

    # 3.1 REST API Routes & Controllers
    draw_box(6, 20, 26, 9.5, c_emerald_bg, c_emerald_border)
    ax.text(19, 26.8, "Express REST API Server", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_emerald_title)
    ax.text(19, 23, "• /api/analysis/start & /upload\n• /api/traffic/readings & /latest\n• /api/roads & /api/cameras", 
            ha='center', va='center', fontsize=7, color='#1E293B')

    # 3.2 Job Dispatcher & AI Bridge
    draw_box(37, 20, 26, 9.5, c_emerald_bg, c_emerald_border)
    ax.text(50, 26.8, "Job Queue & AI Bridge", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_emerald_title)
    ax.text(50, 23, "• Asynchronous Job Tracking\n• ChildProcess CLI / FastAPI HTTP\n• Real-Time Progress Streamer", 
            ha='center', va='center', fontsize=7, color='#1E293B')

    # 3.3 Database Store & Mongoose ODM
    draw_box(68, 20, 26, 9.5, c_emerald_bg, c_emerald_border)
    ax.text(81, 26.8, "Database Storage (Mongoose)", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_emerald_title)
    ax.text(81, 23, "• Primary: MongoDB Atlas / Local\n• Models: Road, Camera, Reading, Job\n• Auto In-Memory Safety Fallback", 
            ha='center', va='center', fontsize=7, color='#1E293B')

    draw_arrow(32, 24.8, 37, 24.8)
    draw_arrow(63, 24.8, 68, 24.8)

    # Down arrow to Frontend Layer
    draw_arrow(19, 18, 19, 13, "HTTP REST API / JSON Telemetry", color=c_emerald_title)

    # =========================================================================
    # TIER 4: PRESENTATION & CONTROL DASHBOARD LAYER (React 18 / Vite / Recharts)
    # =========================================================================
    draw_box(4, 2, 92, 10.5, '#FFFFFF', c_blue_border, radius=1.5, linewidth=2.0)
    ax.text(6, 11, "LAYER 4: PRESENTATION & MONITORING DASHBOARD LAYER (React 18, Vite, Recharts)", 
            fontsize=11, fontweight='bold', color=c_blue_primary)

    # Frontend Components
    # 4.1 KPI Stat Cards
    draw_box(6, 3.5, 20, 6.5, c_blue_light, c_blue_border)
    ax.text(16, 8, "Real-Time KPI Cards", ha='center', va='center', fontsize=8.5, fontweight='bold', color=c_blue_primary)
    ax.text(16, 5.5, "Total Counts, Speed (km/h),\nFlow Rate & Congestion Status", ha='center', va='center', fontsize=6.8, color='#334155')

    # 4.2 Interactive Recharts
    draw_box(29, 3.5, 20, 6.5, c_blue_light, c_blue_border)
    ax.text(39, 8, "Recharts Analytics", ha='center', va='center', fontsize=8.5, fontweight='bold', color=c_blue_primary)
    ax.text(39, 5.5, "Time-Series Flow Curves &\nVehicle Breakdown Bar Charts", ha='center', va='center', fontsize=6.8, color='#334155')

    # 4.3 Video & Overlay Player
    draw_box(52, 3.5, 20, 6.5, c_blue_light, c_blue_border)
    ax.text(62, 8, "Annotated Video Player", ha='center', va='center', fontsize=8.5, fontweight='bold', color=c_blue_primary)
    ax.text(62, 5.5, "Real-Time Tracking Overlays\n& Download Processed MP4", ha='center', va='center', fontsize=6.8, color='#334155')

    # 4.4 History & Registry
    draw_box(75, 3.5, 20, 6.5, c_blue_light, c_blue_border)
    ax.text(85, 8, "Audit Logs & Registry", ha='center', va='center', fontsize=8.5, fontweight='bold', color=c_blue_primary)
    ax.text(85, 5.5, "Corridor Infrastructure Mgmt\n& Historical Execution Logs", ha='center', va='center', fontsize=6.8, color='#334155')

    plt.tight_layout()
    plt.savefig(output_png, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.savefig(output_svg, format='svg', facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"Architecture diagram generated: {output_png} and {output_svg}")

if __name__ == "__main__":
    out_dir = os.getcwd()
    png_path = os.path.join(out_dir, "system_architecture_diagram.png")
    svg_path = os.path.join(out_dir, "system_architecture_diagram.svg")
    create_system_architecture_diagram(png_path, svg_path)

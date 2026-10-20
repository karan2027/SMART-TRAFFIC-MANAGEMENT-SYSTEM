import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute total pages and render running headers/footers.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count):
        self.saveState()
        
        # Header (Pages 2+)
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.75)
            self.line(54, letter[1] - 40, letter[0] - 54, letter[1] - 40)
            
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#1E3A8A"))
            self.drawString(54, letter[1] - 34, "INTELLIGENT TRAFFIC MANAGEMENT SYSTEM (ITMS) — COMPREHENSIVE REPORT")
            
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(letter[0] - 54, letter[1] - 34, "B.Tech Final Year CSE Project")

        # Footer (All pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(54, 45, letter[0] - 54, 45)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 32, "Department of Computer Science & Engineering — Stage 1 & Stage 2 Technical Blueprint")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 32, page_str)
        
        self.restoreState()


def build_comprehensive_pdf(output_filename):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    c_primary = colors.HexColor("#0F172A")    # Slate 900
    c_blue = colors.HexColor("#1D4ED8")       # Blue 700
    c_dark = colors.HexColor("#334155")       # Slate 700
    c_sub = colors.HexColor("#475569")        # Slate 600

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_primary,
        alignment=1,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_blue,
        alignment=1,
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_sub,
        alignment=1,
        spaceAfter=4
    )

    h1_style = ParagraphStyle(
        'H1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_primary,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=c_blue,
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=c_dark,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=12,
        bulletIndent=4,
        spaceAfter=3
    )

    table_body = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_dark
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # ==================== PAGE 1: TITLE, PROJECT SUMMARY & STAGE 1 ACHIEVEMENTS ====================
    story.append(Spacer(1, 8))
    story.append(Paragraph("INTELLIGENT TRAFFIC MANAGEMENT SYSTEM (ITMS)", title_style))
    story.append(Paragraph("STAGE 1 IMPLEMENTATION, SYSTEM METHODOLOGY & NEXT-STAGE ROADMAP", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_blue, spaceAfter=10, spaceBefore=2))

    story.append(Paragraph("<b>Major B.Tech Final-Year Computer Science & Engineering Project Report</b>", meta_style))
    story.append(Paragraph("Academic Year: 2026 – 2027 | Domain: Deep Learning, Computer Vision & Full-Stack Systems", meta_style))
    story.append(Spacer(1, 8))

    # Project Overview Card
    overview_text = """<b>EXECUTIVE SYNOPSIS:</b><br/>
    Urban vehicular congestion causes massive fuel waste, economic degradation, elevated carbon footprints, and severe emergency vehicle delays. Conventional traffic management relies on fixed-duration signal timers and fragile, cost-prohibitive subterranean induction loop sensors. This project engineers a complete <b>Intelligent Traffic Management System (ITMS)</b>. Stage 1 delivers an end-to-end computer-vision perception and telemetry engine that ingests recorded CCTV traffic video, applies YOLOv8 multi-class object detection, executes ByteTrack trajectory tracking, counts directional flow across virtual tripwires, computes calibrated velocities (km/h), and streams analytics to a live React dashboard. This document details Stage 1 accomplishments, technical methodology, stakeholder utility, documented limitations, and the Stage 2 adaptive signal network roadmap.
    """
    card_table = Table([[Paragraph(overview_text, body_style)]], colWidths=[letter[0] - 108])
    card_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
        ('BORDER', (0,0), (-1,-1), 1, colors.HexColor("#BFDBFE")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(card_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("1. What Has Been Implemented in Project Stage 1", h1_style))
    story.append(Paragraph(
        "Stage 1 establishes the complete single-corridor computer vision perception, analytical telemetry, and monitoring dashboard layer. "
        "The following subsystems are fully operational and validated on real-world CCTV footage (e.g., <code>v3.mp4</code>):",
        body_style
    ))

    stage1_items = [
        [Paragraph("<b>Subsystem Feature</b>", table_header), Paragraph("<b>Implementation Details in Stage 1 Codebase</b>", table_header)],
        [Paragraph("<b>YOLOv8 Vehicle Detection</b>", table_body), Paragraph("Trained deep learning model detecting 4 primary classes: Cars (Class 2), Motorcycles (Class 3), Buses (Class 5), and Trucks (Class 7) with dynamic confidence filtering.", table_body)],
        [Paragraph("<b>ByteTrack Multi-Object Tracking</b>", table_body), Paragraph("Assigns persistent, unique numeric IDs to vehicles across frame sequences, preventing double counting and stabilizing tracking through temporary occlusions.", table_body)],
        [Paragraph("<b>Virtual Line Flow Counting</b>", table_body), Paragraph("Calculates bounding-box centroid vector intersection against a calibrated virtual road crossing line, tracking total and directional throughput (Direction A vs B).", table_body)],
        [Paragraph("<b>Calibrated Velocity Estimation</b>", table_body), Paragraph("Transforms pixel displacement over frame deltas into physical meters using 2-point camera calibration, computing real-world speeds in km/h.", table_body)],
        [Paragraph("<b>Density & Congestion Analytics</b>", table_body), Paragraph("Evaluates Region of Interest (ROI) bounding box occupancy percentages and flow rates (veh/hr), classifying status into Free Flow, Moderate, or Congested.", table_body)],
        [Paragraph("<b>Express & MongoDB Backend API</b>", table_body), Paragraph("Manages asynchronous video analysis jobs, stores structured telemetry readings in MongoDB (with automatic in-memory fallback), and exposes REST endpoints.", table_body)],
        [Paragraph("<b>React 18 Control Dashboard</b>", table_body), Paragraph("Interactive single-page application (Vite + Recharts) rendering real-time KPI metrics, vehicle breakdown bar charts, speed line graphs, and annotated video playback.", table_body)]
    ]
    st1_table = Table(stage1_items, colWidths=[150, 354])
    st1_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(st1_table)

    story.append(PageBreak())

    # ==================== PAGE 2: METHODOLOGY & MATHEMATICAL FORMULATIONS ====================
    story.append(Paragraph("2. Technical Methodology & System Flow", h1_style))
    story.append(Paragraph(
        "The project processes CCTV video frames through a strict mathematical and computational vision pipeline. "
        "The complete data processing lifecycle is shown below:",
        body_style
    ))

    # Visual Flowchart Table
    fc_box = lambda title, sub, bg="#F8FAFC", border="#CBD5E1": Table([
        [Paragraph(f"<b>{title}</b>", ParagraphStyle('FCTitle', parent=table_header, alignment=1))],
        [Paragraph(sub, ParagraphStyle('FCSub', parent=table_body, alignment=1, fontSize=7, leading=9))]
    ], colWidths=[450])
    
    fc_style = [
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#94A3B8")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]

    arr = Paragraph("<font color='#1D4ED8'><b>&#9660;</b></font>", ParagraphStyle('Arr', alignment=1, fontSize=9))

    step1 = Table([[Paragraph("<b>1. Video Ingestion & Region of Interest (ROI) Spatial Masking</b>", table_header)],
                   [Paragraph("OpenCV reads frame stream; polygonal mask isolates driving lanes from irrelevant background sidewalks.", table_body)]], colWidths=[460])
    step1.setStyle(TableStyle(fc_style))

    step2 = Table([[Paragraph("<b>2. Deep Learning Object Detection (YOLOv8 Inference)</b>", table_header)],
                   [Paragraph("Generates bounding boxes (xmin, ymin, xmax, ymax) and class confidences for cars, motorcycles, buses, and trucks.", table_body)]], colWidths=[460])
    step2.setStyle(TableStyle(fc_style))

    step3 = Table([[Paragraph("<b>3. Trajectory Association (ByteTrack Multi-Object Tracking)</b>", table_header)],
                   [Paragraph("Kalman filtering and Hungarian matching assign persistent track IDs across frames; computes vehicle centroid coordinates.", table_body)]], colWidths=[460])
    step3.setStyle(TableStyle(fc_style))

    step4 = Table([[Paragraph("<b>4. Virtual Tripwire Intersection & Directional Vector Analysis</b>", table_header)],
                   [Paragraph("Detects centroid crossing across line segment; calculates cross product to categorize Direction A vs Direction B.", table_body)]], colWidths=[460])
    step4.setStyle(TableStyle(fc_style))

    step5 = Table([[Paragraph("<b>5. Physics-Based Speed & Density Computation</b>", table_header)],
                   [Paragraph("Converts pixel displacement to meters using 2-point calibration scale; evaluates road occupancy percentage.", table_body)]], colWidths=[460])
    step5.setStyle(TableStyle(fc_style))

    step6 = Table([[Paragraph("<b>6. Backend Synchronization, MongoDB Persistence & React Visualization</b>", table_header)],
                   [Paragraph("Telemetry dispatched via REST/JSON; stored in database; rendered on real-time Recharts dashboard.", table_body)]], colWidths=[460])
    step6.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDF4")),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#86EFAC")),
        ('PADDING', (0,0), (-1,-1), 3),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))

    flow_wrapper = Table([[step1], [arr], [step2], [arr], [step3], [arr], [step4], [arr], [step5], [arr], [step6]], colWidths=[480])
    flow_wrapper.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER'), ('PADDING', (0,0), (-1,-1), 0.5)]))
    story.append(flow_wrapper)
    story.append(Spacer(1, 8))

    story.append(Paragraph("2.1 Mathematical Formulations Applied in Code", h2_style))
    story.append(Paragraph(
        "<b>1. Virtual Line Crossing Algorithm:</b> For virtual counting line defined by points P1(x1, y1) and P2(x2, y2), the side on which a centroid C(xc, yc) lies is determined by the 2D cross product sign:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>D(C)</b> = (x2 - x1) &times; (yc - y1) - (y2 - y1) &times; (xc - x1)<br/>"
        "A crossing occurs when <code>sign(D(C_{t-1})) != sign(D(C_t))</code> for track ID <i>k</i>, incrementing the counter exactly once.",
        body_style
    ))
    story.append(Paragraph(
        "<b>2. Calibrated Velocity Calculation:</b> Centroid pixel coordinates are mapped to physical metric distance using calibrated scaling factor <i>S_px</i> (meters per pixel) and camera frame rate <i>FPS</i>:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Delta_d (meters)</b> = &radic;((x_t - x_{t-1})^2 + (y_t - y_{t-1})^2) &times; S_px<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Speed (km/h)</b> = (Delta_d &times; FPS) &times; 3.6",
        body_style
    ))
    story.append(Paragraph(
        "<b>3. Road Occupancy & Hourly Traffic Flow:</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Occupancy (%)</b> = [ &sum; Area(Vehicle Bounding Boxes) / Area(Road ROI Polygon) ] &times; 100<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Flow Rate (veh/hr)</b> = [ Total Vehicles Counted / Elapsed Video Time (seconds) ] &times; 3600",
        body_style
    ))

    story.append(PageBreak())

    # ==================== PAGE 3: WHAT IS THE NEXT STAGE (STAGE 2) & ROADMAP ====================
    story.append(Paragraph("3. Next Stage: Stage 2 Architecture & Upcoming Features", h1_style))
    story.append(Paragraph(
        "Stage 1 delivers single-corridor <b>Perception & Analysis</b>. The upcoming <b>Stage 2</b> expands the project from passive monitoring "
        "into an active, intelligent <b>Multi-Intersection Adaptive Traffic Control System</b>.",
        body_style
    ))

    story.append(Paragraph("3.1 Core Deliverables of Stage 2", h2_style))

    st2_features = [
        [Paragraph("<b>Stage 2 Module</b>", table_header), Paragraph("<b>Functionality & Work the Project Will Perform</b>", table_header)],
        [Paragraph("<b>4-Way Intersection Coordination</b>", table_body), Paragraph("Scales camera ingestion from 1 single road to a 4-approach junction (North, South, East, West). Ingests 4 video streams concurrently and maintains synchronous road queues.", table_body)],
        [Paragraph("<b>Dynamic Green Light Timing</b>", table_body), Paragraph("Replaces static 45-second timers with real-time adaptive signal control algorithms (Webster's Delay Optimization & Reinforcement Learning). Green time is dynamically allocated proportionally to vehicle queue length and waiting density.", table_body)],
        [Paragraph("<b>Emergency Vehicle Priority (Green Wave)</b>", table_body), Paragraph("Automatically classifies Ambulances, Fire Trucks, and Police vehicles. Instantly pre-empts normal cycle and turns the corresponding approach green to establish an uninterrupted green-wave corridor.", table_body)],
        [Paragraph("<b>RTSP Live Stream Ingestion</b>", table_body), Paragraph("Transitions from recorded .mp4 video files to direct RTSP/HLS network streams connected to live IP cameras installed at physical intersections.", table_body)],
        [Paragraph("<b>Automated Signal Actuation Simulation</b>", table_body), Paragraph("Simulates physical traffic signal controllers (Red, Yellow, Green bulbs) synchronized with live video analysis, demonstrating reduction in cumulative intersection delay.", table_body)]
    ]
    st2_table = Table(st2_features, colWidths=[150, 354])
    st2_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(st2_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("3.2 Conceptual Architecture for Stage 2 Adaptive Control", h2_style))

    st2_arch_text = """
    +---------------------------------------------------------------------------------------+
    |                    4-WAY INTERSECTION CAMERA INGESTION (RTSP / VIDEO)                 |
    |      [Approach North Cam]    [Approach South Cam]    [Approach East]    [Approach West]  |
    +-------------------------------------------+-------------------------------------------+
                                                | Real-time Bounding Boxes & Queue Counts
                                                v
    +---------------------------------------------------------------------------------------+
    |                    ADAPTIVE TRAFFIC SIGNAL DECISION ENGINE (Stage 2)                  |
    |  • Queue Length Extraction: Q_north, Q_south, Q_east, Q_west                          |
    |  • Webster's Cycle Allocation Formula: Green_i = (Y_i / Y_total) * (C - L)           |
    |  • Emergency Vehicle Pre-emption: Ambulance detected -> Immediate Force Green Corridor|
    +-------------------------------------------+-------------------------------------------+
                                                | Signal Control Commands (Phase & Duration)
                                                v
    +---------------------------------------------------------------------------------------+
    |                    SYNCHRONIZED INTERSECTION CONTROLLER & DASHBOARD                   |
    |  • Virtual Signal Actuator (Red / Yellow / Green countdown display)                   |
    |  • Telemetry Streamer: Delay reduction metrics, fuel saved %, emissions lowered       |
    +---------------------------------------------------------------------------------------+
    """
    st2_arch_table = Table([[Paragraph(f"<font face='Courier' size=7.5>{st2_arch_text.strip().replace(chr(10), '<br/>')}</font>", body_style)]], colWidths=[letter[0] - 108])
    st2_arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BORDER', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(st2_arch_table)

    story.append(PageBreak())

    # ==================== PAGE 4: TARGET AUDIENCE, UTILITY & STAKEHOLDERS ====================
    story.append(Paragraph("4. Target Audience: Who Will Use This System & Why It Is Useful", h1_style))
    story.append(Paragraph(
        "This project bridges the gap between theoretical deep learning and municipal civic infrastructure. "
        "The table below outlines who will directly utilize this system and how each stakeholder benefits:",
        body_style
    ))

    stakeholders = [
        [Paragraph("<b>Stakeholder / User</b>", table_header), Paragraph("<b>How They Use the System</b>", table_header), Paragraph("<b>Direct Civic & Economic Benefit</b>", table_header)],
        [
            Paragraph("<b>Traffic Police & Control Rooms</b>", table_body),
            Paragraph("Monitor live corridor health, receive automated alerts for bottlenecks, and observe vehicle velocity patterns.", table_body),
            Paragraph("Eliminates manual officer stationing at every corner; enables rapid dispatch to traffic snarls before gridlock spreads.", table_body)
        ],
        [
            Paragraph("<b>Smart City & Municipal Authorities</b>", table_body),
            Paragraph("Access aggregated daily/monthly traffic density logs, vehicle class distributions, and hourly peak patterns.", table_body),
            Paragraph("Provides evidence-based telemetry to justify new flyovers, lane expansions, and smart signal deployment budgets.", table_body)
        ],
        [
            Paragraph("<b>Emergency First Responders (Ambulance/Fire)</b>", table_body),
            Paragraph("Benefit from Stage 2 green wave pre-emption that clears waiting vehicle queues along the transit route.", table_body),
            Paragraph("Saves lives by cutting emergency transit response times by an estimated 35% to 50% during rush hours.", table_body)
        ],
        [
            Paragraph("<b>Urban Planners & Civil Engineers</b>", table_body),
            Paragraph("Analyze historical flow curves (vph) to assess Level of Service (LOS) across major arterial roads.", table_body),
            Paragraph("Replaces manual clipboard counting surveys with 24/7 continuous digital vehicle census data.", table_body)
        ],
        [
            Paragraph("<b>Commuters & General Public</b>", table_body),
            Paragraph("Experience dynamic signal timing that minimizes unnecessary red-light idling when cross-traffic is empty.", table_body),
            Paragraph("Saves personal commute time, reduces fuel expenses, and lowers urban carbon emissions (CO2 & PM2.5).", table_body)
        ]
    ]
    stk_table = Table(stakeholders, colWidths=[110, 194, 200])
    stk_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(stk_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("4.1 Value Proposition Comparison: Traditional vs ITMS", h2_style))
    comp_data = [
        [Paragraph("<b>Assessment Factor</b>", table_header), Paragraph("<b>Conventional Traffic Management</b>", table_header), Paragraph("<b>Our Intelligent Traffic System (ITMS)</b>", table_header)],
        [Paragraph("<b>Signal Control</b>", table_body), Paragraph("Fixed cycle timers (e.g. 60s red / 60s green) regardless of queue.", table_body), Paragraph("Dynamic adaptive timing proportional to live detected queues.", table_body)],
        [Paragraph("<b>Vehicle Sensing</b>", table_body), Paragraph("Under-asphalt inductive loops; prone to asphalt cuts & failure.", table_body), Paragraph("Non-intrusive CCTV video analysis with zero road excavation.", table_body)],
        [Paragraph("<b>Vehicle Classification</b>", table_body), Paragraph("Unable to differentiate between a bus, truck, or motorcycle.", table_body), Paragraph("YOLOv8 deep learning categorizes 4 distinct vehicle classes.", table_body)],
        [Paragraph("<b>Installation Cost</b>", table_body), Paragraph("High capital expenditure ($10,000+ per intersection sensor grid).", table_body), Paragraph("Leverages pre-existing CCTV camera infrastructure.", table_body)],
        [Paragraph("<b>Analytics & Auditing</b>", table_body), Paragraph("No digital audit trail; paper logbooks or spot checks.", table_body), Paragraph("Continuous MongoDB time-series telemetry & React dashboard.", table_body)]
    ]
    comp_table = Table(comp_data, colWidths=[110, 194, 200])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(comp_table)

    story.append(PageBreak())

    # ==================== PAGE 5: LIMITATIONS, CHALLENGES & FUTURE SCOPE ====================
    story.append(Paragraph("5. Technical Limitations & Engineering Challenges", h1_style))
    story.append(Paragraph(
        "Maintaining academic rigor requires documenting the technical boundaries and real-world edge cases of the current implementation:",
        body_style
    ))

    story.append(Paragraph("1. <b>Camera Perspective & 2-Point Calibration Dependency:</b> Velocity estimation maps 2D pixel coordinates to 3D physical world space using a 2-point reference scale. If camera pitch, tilt, or focal length changes without re-calibrating parameters, velocity accuracy degrades.", bullet_style))
    story.append(Paragraph("2. <b>Vehicle Occlusion in Dense Queues:</b> When heavy high-profile vehicles (e.g., multi-axle freight trucks or double-decker buses) sit close to the camera, they physically occlude smaller vehicles (scooters, bicycles) trailing behind them, causing temporary tracking misses.", bullet_style))
    story.append(Paragraph("3. <b>Adverse Environmental & Weather Conditions:</b> Heavy monsoonal rain, dense winter smog/fog, lens droplet distortion, and headlight glare during pitch-black night conditions challenge YOLOv8 feature extraction without specialized low-light fine-tuning.", bullet_style))
    story.append(Paragraph("4. <b>Offline File Ingestion vs Hardware Signal PLC Actuation:</b> Stage 1 ingests recorded video files (.mp4) and simulates analysis in software. Direct electrical interfacing with municipal NEMA/170 signal controller cabinets remains a future integration boundary.", bullet_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph("6. Future Scope: Stage 3 & Long-Term Vision", h1_style))
    story.append(Paragraph(
        "Beyond Stage 2 (Multi-Intersection Adaptive Signals), the system architecture is structured to expand into city-scale intelligent mobility:",
        body_style
    ))

    story.append(Paragraph("• <b>Deep Reinforcement Learning (DQN / PPO) Network Control:</b> Instead of rule-based Webster formulas, an autonomous RL agent optimizes coordinated green-wave phases across an entire grid of 50+ interlinked city junctions.", bullet_style))
    story.append(Paragraph("• <b>Automatic Number Plate Recognition (ANPR) & E-Challan Integration:</b> Incorporate Optical Character Recognition (OCR) to detect red-light runners, wrong-side driving, and over-speeding vehicles for automated traffic law enforcement.", bullet_style))
    story.append(Paragraph("• <b>Vehicle-to-Infrastructure (V2I / V2X) Connectivity:</b> Broadcast real-time signal phase countdowns (SPaT messages) directly to onboard connected vehicle dashboards (Android Auto / Apple CarPlay) to minimize stop-and-go acceleration.", bullet_style))
    story.append(Paragraph("• <b>Edge AI Embedded Deployment:</b> Optimize YOLOv8 weights using TensorRT / ONNX for low-power edge execution directly on junction pole microcomputers (NVIDIA Jetson Orin Nano).", bullet_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph("7. Project Summary & Faculty Viva Quick-Reference", h1_style))

    viva_summary = [
        [Paragraph("<b>Question Area</b>", table_header), Paragraph("<b>Key Technical Answer for Evaluation Committee</b>", table_header)],
        [Paragraph("<b>What is Stage 1?</b>", table_body), Paragraph("Single-corridor video analysis: YOLOv8 detection, ByteTrack tracking, virtual line counting, speed estimation, congestion rating, and React dashboard.", table_body)],
        [Paragraph("<b>What is Stage 2?</b>", table_body), Paragraph("4-way junction expansion with dynamic adaptive green-light duration calculation and emergency vehicle priority corridor dispatch.", table_body)],
        [Paragraph("<b>Is it using a real DB?</b>", table_body), Paragraph("Yes, Mongoose schemas for Roads, Cameras, TrafficReadings, and Jobs connected to MongoDB / MongoDB Atlas, with an automatic in-memory fallback.", table_body)],
        [Paragraph("<b>Is the AI real or dummy?</b>", table_body), Paragraph("100% real. It executes live YOLOv8 inference and ByteTrack algorithms on actual video frames (.mp4), generating real telemetry coordinates and counts.", table_body)]
    ]
    viva_table = Table(viva_summary, colWidths=[130, 374])
    viva_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0,0), (-1,-1), 4.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(viva_table)

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8, spaceBefore=4))
    story.append(Paragraph("<b>Intelligent Traffic Management System — Stage 1 & Stage 2 Technical Blueprint</b>", meta_style))

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Comprehensive report generated successfully at: {output_filename}")

if __name__ == "__main__":
    output_pdf = os.path.join(os.getcwd(), "ITMS_Comprehensive_Project_Report.pdf")
    build_comprehensive_pdf(output_pdf)

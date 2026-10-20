# Setup & Installation Guide — Stage 1

## Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.10 to v3.13
- **MongoDB**: Local MongoDB instance or Mongo Atlas (Optional: embedded memory server fallback provided automatically for dev mode)

---

## Step 1: Install Python AI Engine Dependencies
```bash
cd ai-engine
python -m pip install -r requirements.txt
cd ..
```

## Step 2: Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

## Step 3: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

## Step 4: Generate Test Video
```bash
python data/create_sample_video.py
```

## Step 5: Start All Services

### Terminal 1: Python AI Service (Optional HTTP Mode or Direct CLI Fallback)
```bash
cd ai-engine
python main.py --server --port 8000
```

### Terminal 2: Node.js Backend Server
```bash
cd backend
npm run dev
```

### Terminal 3: React Dashboard Frontend
```bash
cd frontend
npm run dev
```
Open Dashboard at: `http://localhost:3000`

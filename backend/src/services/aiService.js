const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

class AIService {
  static async checkHealth() {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 3000 });
      return response.data;
    } catch (err) {
      return {
        status: 'offline',
        service: 'traffic-ai-engine',
        message: 'FastAPI HTTP service unavailable, will use direct process execution fallback.',
        error: err.message
      };
    }
  }

  static async runAnalysis({ jobId, videoPath, cameraId, roadId, progressCallback }) {
    // Check if HTTP AI service is responsive
    const health = await this.checkHealth();

    if (health.status === 'ok') {
      try {
        console.log(`[AI SERVICE] Invoking Python AI HTTP Service for job ${jobId}...`);
        const response = await axios.post(`${AI_SERVICE_URL}/analyze-sync`, {
          videoPath,
          cameraId,
          roadId,
          jobId
        }, { timeout: 600000 }); // 10 min timeout for long videos

        if (response.data && response.data.success) {
          return response.data.data;
        }
      } catch (httpErr) {
        console.warn(`[AI SERVICE WARNING] HTTP Service call failed (${httpErr.message}). Falling back to direct CLI execution...`);
      }
    }

    // Direct CLI Fallback: Spawn Python process
    console.log(`[AI SERVICE FALLBACK] Spawning Python AI Engine CLI for video: ${videoPath}`);
    return new Promise((resolve, reject) => {
      const aiEngineDir = path.resolve(__dirname, '../../../ai-engine');
      const pythonExec = process.env.PYTHON_EXECUTABLE || 'python';

      const pyProcess = spawn(pythonExec, [
        'main.py',
        '--video', videoPath,
        '--camera', cameraId,
        '--road', roadId
      ], { cwd: aiEngineDir });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdoutData += text;
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('PROGRESS:')) {
            try {
              const payload = JSON.parse(trimmed.slice(9));
              if (progressCallback && typeof progressCallback === 'function') {
                progressCallback(payload);
              }
            } catch (jsonErr) {}
          } else if (trimmed) {
            console.log(`[PYTHON AI STDOUT]: ${trimmed}`);
          }
        }
      });

      pyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.warn(`[PYTHON AI STDERR]: ${data.toString().trim()}`);
      });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Python AI Engine process exited with code ${code}. Stderr: ${stderrData}`));
        }

        // Locate created summary JSON file in data/outputs
        const outputsDir = path.resolve(__dirname, '../../../data/outputs');
        const baseName = path.basename(videoPath, path.extname(videoPath));
        
        const files = fs.readdirSync(outputsDir)
          .filter(f => f.startsWith(`${baseName}_summary_`) && f.endsWith('.json'))
          .sort((a, b) => fs.statSync(path.join(outputsDir, b)).mtime - fs.statSync(path.join(outputsDir, a)).mtime);

        if (files.length === 0) {
          return reject(new Error(`AI analysis finished but summary JSON file was not found in outputs directory.`));
        }

        const summaryFilePath = path.join(outputsDir, files[0]);
        const summaryContent = JSON.parse(fs.readFileSync(summaryFilePath, 'utf8'));
        resolve(summaryContent);
      });

      pyProcess.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });
    });
  }
}

module.exports = AIService;

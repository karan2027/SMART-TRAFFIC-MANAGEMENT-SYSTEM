const DBStore = require('../services/dbStore');

// GET /api/alerts - List alerts
exports.getAlerts = async (req, res, next) => {
  try {
    const { status, severity, limit } = req.query;
    const alerts = await DBStore.getAlerts({ status, severity, limit });
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
};

// POST /api/alerts - Create alert
exports.createAlert = async (req, res, next) => {
  try {
    const { type, severity, title, message, junctionId, roadId, metadata } = req.body;
    if (!type || !title || !message) {
      return res.status(400).json({ success: false, message: 'type, title, and message are required' });
    }

    const alert = await DBStore.createAlert({
      type,
      severity: severity || 'MEDIUM',
      title,
      message,
      junctionId: junctionId || '',
      roadId: roadId || '',
      metadata: metadata || {}
    });

    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

// PUT /api/alerts/:alertId/acknowledge - Acknowledge alert
exports.acknowledgeAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy = 'Operator' } = req.body;

    const alert = await DBStore.acknowledgeAlert(alertId, acknowledgedBy);
    if (!alert) {
      return res.status(404).json({ success: false, message: `Alert ${alertId} not found` });
    }

    res.json({ success: true, message: `Alert ${alertId} acknowledged`, data: alert });
  } catch (err) {
    next(err);
  }
};

// PUT /api/alerts/:alertId/resolve - Resolve alert
exports.resolveAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const alert = await DBStore.resolveAlert(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: `Alert ${alertId} not found` });
    }

    res.json({ success: true, message: `Alert ${alertId} marked as RESOLVED`, data: alert });
  } catch (err) {
    next(err);
  }
};

// GET /api/alerts/stream - Server-Sent Events real-time alert feed
exports.streamAlerts = async (req, res, next) => {
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send connected ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Real-time alert stream active', timestamp: new Date().toISOString() })}\n\n`);

    const onAlert = (alert) => {
      res.write(`data: ${JSON.stringify({ type: 'ALERT', data: alert, timestamp: new Date().toISOString() })}\n\n`);
    };

    DBStore.alertEmitter.on('alert', onAlert);

    req.on('close', () => {
      DBStore.alertEmitter.off('alert', onAlert);
      res.end();
    });
  } catch (err) {
    next(err);
  }
};

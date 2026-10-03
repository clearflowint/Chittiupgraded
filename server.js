import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Secure n8n -> ClearFlow dispatch callback endpoint
app.post('/api/communication/dispatch-callback', (req, res) => {
  const secret = process.env.COMMUNICATION_CALLBACK_SECRET || 'clearflow_n8n_secret_prod_2026';
  const authHeader = req.headers['authorization'] || req.headers['x-clearflow-callback-secret'];
  
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Authentication required: missing callback secret' });
  }

  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (bearer !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid callback secret' });
  }

  const { dispatchId, tenantId, status, total, sent, failed, skipped, errorMessage, completedAt } = req.body || {};
  if (!dispatchId || typeof dispatchId !== 'string' || !dispatchId.trim()) {
    return res.status(400).json({ success: false, error: 'Missing or invalid required parameter: dispatchId' });
  }

  if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
    return res.status(400).json({ success: false, error: 'Missing or invalid required parameter: tenantId' });
  }

  const allowedStatuses = ['received', 'processing', 'completed', 'failed'];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Invalid status transition: must be one of ${allowedStatuses.join(', ')}` });
  }

  console.log(`[ClearFlow Production Callback] Authenticated dispatch update for ${dispatchId} (Tenant: ${tenantId}):`, {
    status,
    total: typeof total === 'number' ? total : undefined,
    sent: typeof sent === 'number' ? sent : undefined,
    failed: typeof failed === 'number' ? failed : undefined,
    skipped: typeof skipped === 'number' ? skipped : undefined,
    errorMessage: errorMessage || null,
    completedAt: completedAt || (status === 'completed' || status === 'failed' ? new Date().toISOString() : null),
  });

  return res.status(200).json({
    success: true,
    message: 'Dispatch callback authenticated and recorded',
    dispatchId,
    tenantId,
    status,
    receivedAt: new Date().toISOString(),
  });
});

// Serve static assets from the build directory (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// Redirect all other requests to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});

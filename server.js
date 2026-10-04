import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase Applet Config
const configPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig = {};
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.error('[ClearFlow Server] Failed to read firebase config:', e);
}

// Initialize Firebase Admin SDK
if (firebaseConfig.projectId) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log('[ClearFlow Server] Firebase Admin initialized for project:', firebaseConfig.projectId);
  } catch (e) {
    console.error('[ClearFlow Server] Firebase Admin init error:', e);
  }
} else {
  console.warn('[ClearFlow Server] No Firebase Project ID found in config.');
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Secure n8n -> ClearFlow dispatch callback endpoint
app.post('/api/communication/dispatch-callback', async (req, res) => {
  const secret = process.env.COMMUNICATION_CALLBACK_SECRET;
  if (!secret) {
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration error: callback secret is not configured' 
    });
  }

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

  try {
    const db = admin.firestore();
    if (firebaseConfig.firestoreDatabaseId) {
      db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
    }

    const dispatchRef = db.collection('dispatches').doc(dispatchId);
    const docSnap = await dispatchRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: `Dispatch record not found: ${dispatchId}` });
    }

    const existingData = docSnap.data();

    // Confirm callback tenantId matches the dispatch record's authoritative tenant identity
    if (existingData.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Tenant mismatch' });
    }

    // Prepare update parameters safely (idempotent, preserve existing identities)
    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (typeof total === 'number') updateData.total = total;
    if (typeof sent === 'number') updateData.sent = sent;
    if (typeof failed === 'number') updateData.failed = failed;
    if (typeof skipped === 'number') updateData.skipped = skipped;
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
    
    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = completedAt || new Date().toISOString();
    }

    // Write authoritative update to Firestore
    await dispatchRef.update(updateData);

    console.log(`[ClearFlow Production Callback] Authenticated and updated dispatch ${dispatchId}:`, updateData);

    return res.status(200).json({
      success: true,
      message: 'Dispatch callback authenticated and recorded',
      dispatchId,
      tenantId,
      status,
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ClearFlow Production Callback] Processing error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while writing dispatch updates' });
  }
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

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import fs from 'fs';
import admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';

// Read Firebase Applet Config
const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.error('[ClearFlow Vite Config] Failed to read firebase config:', e);
}

// Initialize Firebase Admin SDK
if (firebaseConfig.projectId) {
  try {
    if (getApps().length === 0) {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log('[ClearFlow Vite Config] Firebase Admin initialized for project:', firebaseConfig.projectId);
    }
  } catch (e) {
    console.error('[ClearFlow Vite Config] Firebase Admin init error:', e);
  }
}

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'communication-callback-api-plugin',
        configureServer(server) {
          server.middlewares.use('/api/communication/dispatch-callback', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
              return;
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const secret = process.env.COMMUNICATION_CALLBACK_SECRET;
                if (!secret) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Server configuration error: callback secret is not configured' }));
                  return;
                }

                const authHeader = req.headers['authorization'] || req.headers['x-clearflow-callback-secret'];

                if (!authHeader) {
                  res.statusCode = 401;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Authentication required: missing callback secret' }));
                  return;
                }

                const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
                if (bearer !== secret) {
                  res.statusCode = 401;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Unauthorized: invalid callback secret' }));
                  return;
                }

                const parsed = body ? JSON.parse(body) : {};
                const { dispatchId, tenantId, status, total, sent, failed, skipped, errorMessage, completedAt } = parsed;

                if (!dispatchId || typeof dispatchId !== 'string' || !dispatchId.trim()) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Missing or invalid required parameter: dispatchId' }));
                  return;
                }

                if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Missing or invalid required parameter: tenantId' }));
                  return;
                }

                const allowedStatuses = ['received', 'processing', 'completed', 'failed'];
                if (!status || !allowedStatuses.includes(status)) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: `Invalid status transition: must be one of ${allowedStatuses.join(', ')}` }));
                  return;
                }

                try {
                  const db = admin.firestore();
                  if (firebaseConfig.firestoreDatabaseId) {
                    db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
                  }

                  const dispatchRef = db.collection('dispatches').doc(dispatchId);
                  const docSnap = await dispatchRef.get();

                  if (!docSnap.exists) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: `Dispatch record not found: ${dispatchId}` }));
                    return;
                  }

                  const existingData = docSnap.data();

                  if (existingData && existingData.tenantId !== tenantId) {
                    res.statusCode = 403;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Unauthorized: Tenant mismatch' }));
                    return;
                  }

                  // Prepare update parameters safely (idempotent, preserve existing identities)
                  const updateData: any = {
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

                  console.log(`[ClearFlow Dev Callback] Authenticated and updated dispatch ${dispatchId}:`, updateData);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    message: 'Dispatch callback authenticated and recorded',
                    dispatchId,
                    tenantId,
                    status,
                    receivedAt: new Date().toISOString(),
                  }));
                } catch (dbErr: any) {
                  console.error('[ClearFlow Dev Callback] Firestore database error:', dbErr);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'Internal server error while writing dispatch updates' }));
                }
              } catch (e: any) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
              }
            });
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'ClearFlow - Financial Operations',
          short_name: 'ClearFlow',
          description: 'Production-grade Chit Fund & Rotating Savings Operations Platform',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

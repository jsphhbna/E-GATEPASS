import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  addDoc,
  collection,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import type { GatePass, Device } from '@/types';

type ScanStatus = 'ready' | 'processing' | 'success' | 'error';

export function EntryScanPage() {
  const { uid, userData } = useAuth();
  const [status, setStatus] = useState<ScanStatus>('ready');
  const [statusMessage, setStatusMessage] = useState('Scan a QR code');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const debounceRef = useRef(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const device = userData as Device | null;
  const gate = device?.gate ?? 'Unknown Gate';

  // ============================================================
  // PROCESS SCANNED QR
  // ============================================================
  const processQR = useCallback(
    async (passId: string) => {
      if (debounceRef.current) return;
      debounceRef.current = true;

      setStatus('processing');
      setStatusMessage('Verifying…');

      try {
        // Look up the gate pass
        const passRef = doc(db, 'gatePasses', passId);
        const passSnap = await getDoc(passRef);

        if (!passSnap.exists()) {
          throw { code: 'not_found', message: 'QR code not recognized' };
        }

        const pass = passSnap.data() as GatePass;
        const now = Timestamp.now();

        // Check if expired (validUntil < now)
        if (pass.validUntil && pass.validUntil.toMillis() < now.toMillis()) {
          // Mark as expired if still issued
          if (pass.status === 'issued') {
            await updateDoc(passRef, { status: 'expired' });
          }
          throw { code: 'expired', message: 'This pass has expired' };
        }

        // Check if outside working hours (validFrom > now)
        if (pass.validFrom && pass.validFrom.toMillis() > now.toMillis()) {
          throw { code: 'early', message: 'Pass is not yet valid' };
        }

        // Status-based transitions
        switch (pass.status) {
          case 'issued': {
            // issued → pending (entry scan)
            await runTransaction(db, async (transaction) => {
              const freshSnap = await transaction.get(passRef);
              if (!freshSnap.exists()) throw new Error('Pass deleted');
              const freshData = freshSnap.data() as GatePass;

              if (freshData.status !== 'issued') {
                throw { code: 'already_scanned', message: 'This pass has already been scanned' };
              }

              transaction.update(passRef, {
                status: 'pending',
                scannedAt: serverTimestamp(),
                entryDeviceId: uid,
                gate,
              });
            });

            // Create visit log
            await addDoc(collection(db, 'visitLogs'), {
              passToken: passId,
              visitorId: pass.visitorId,
              event: 'scan_entry',
              reason: null,
              deviceId: uid,
              gate,
              guardUid: null,
              timestamp: serverTimestamp(),
            });

            setStatus('success');
            setStatusMessage('Scanned! Waiting for guard approval…');
            toast.success('Pass scanned — pending guard approval', {
              style: {
                backgroundColor: '#16a34a',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 'bold',
              },
            });
            break;
          }

          case 'pending':
            throw { code: 'already_scanned', message: 'Already scanned — awaiting guard approval' };

          case 'inside':
            throw { code: 'already_scanned', message: 'Visitor is already inside' };

          case 'rejected':
            throw { code: 'rejected', message: 'This pass was rejected' };

          case 'exited':
            throw { code: 'already_used', message: 'This pass has already been used' };

          case 'expired':
            throw { code: 'expired', message: 'This pass has expired' };

          default:
            throw { code: 'unknown', message: 'Unknown pass status' };
        }
      } catch (err: unknown) {
        const errObj = err as { code?: string; message?: string };
        const message = errObj.message ?? 'Scan failed';
        setStatus('error');
        setStatusMessage(message);
        toast.error(message, {
          style: {
            backgroundColor: '#dc2626',
            color: '#fff',
            fontSize: '18px',
            fontWeight: 'bold',
          },
        });

        // Log invalid scans
        if (errObj.code) {
          await addDoc(collection(db, 'visitLogs'), {
            passToken: passId,
            visitorId: null,
            event: 'invalid_scan',
            reason: message,
            deviceId: uid,
            gate,
            guardUid: null,
            timestamp: serverTimestamp(),
          }).catch(() => {});
        }
      } finally {
        // Reset after 3 seconds
        resetTimerRef.current = setTimeout(() => {
          setStatus('ready');
          setStatusMessage('Scan a QR code');
          debounceRef.current = false;
        }, 3000);
      }
    },
    [uid, gate]
  );

  // ============================================================
  // QR SCANNER LIFECYCLE
  // ============================================================
  useEffect(() => {
    const scannerId = 'entry-qr-reader';

    // Small delay to ensure DOM element exists
    const initTimer = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            processQR(decodedText);
          },
          () => {
            // QR not detected in frame — no-op
          }
        );
      } catch (err) {
        console.error('QR scanner init error:', err);
      }
    }, 500);

    return () => {
      clearTimeout(initTimer);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      scannerRef.current
        ?.stop()
        .catch(() => {});
    };
  }, [processQR]);

  // ============================================================
  // STATUS COLORS
  // ============================================================
  const statusConfig = {
    ready: {
      bg: 'var(--color-brand)',
      icon: <BrandMark size="sm" />,
    },
    processing: {
      bg: 'var(--color-warning)',
      icon: (
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-white border-t-transparent" />
      ),
    },
    success: {
      bg: 'var(--color-success)',
      icon: <CheckCircle2 className="h-8 w-8 text-white" />,
    },
    error: {
      bg: 'var(--color-danger)',
      icon: <XCircle className="h-8 w-8 text-white" />,
    },
  };

  const config = statusConfig[status];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {/* Gate label with hidden logout */}
      <div 
        className="mb-4 text-center cursor-default"
        onDoubleClick={() => {
          if (window.confirm('Admin: Sign out of this scanner?')) {
            auth.signOut();
          }
        }}
      >
        <p className="text-xs font-medium uppercase tracking-widest text-white/50">
          Entry Scanner
        </p>
        <p className="text-sm font-bold text-white">{gate}</p>
      </div>

      {/* Scanner viewport */}
      <div
        className="relative mb-6 aspect-square w-full max-w-sm overflow-hidden rounded-2xl"
        style={{ borderRadius: 'var(--radius-xl)' }}
      >
        <div id="entry-qr-reader" className="h-full w-full" />
      </div>

      {/* Status indicator */}
      <div
        className="flex items-center gap-3 rounded-xl px-6 py-3"
        style={{
          backgroundColor: config.bg,
          borderRadius: 'var(--radius-lg)',
          transition: 'background-color 200ms ease',
        }}
      >
        {config.icon}
        <span className="text-base font-semibold text-white">
          {statusMessage}
        </span>
      </div>

      {/* Device not registered warning */}
      {!device && (
        <div className="mt-6 flex items-center gap-2 rounded-md px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)' }}>
          <AlertTriangle className="h-4 w-4" />
          Device not registered. Contact admin.
        </div>
      )}
    </main>
  );
}

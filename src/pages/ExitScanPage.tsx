import { useEffect, useRef, useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  addDoc,
  collection,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import { LogOut as LogOutIcon, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { GatePass, Device } from '@/types';

type ScanStatus = 'ready' | 'processing' | 'success' | 'error';

export function ExitScanPage() {
  const { uid, userData } = useAuth();
  const [status, setStatus] = useState<ScanStatus>('ready');
  const [statusMessage, setStatusMessage] = useState('Scan QR to exit');
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
        const passRef = doc(db, 'gatePasses', passId);
        const passSnap = await getDoc(passRef);

        if (!passSnap.exists()) {
          throw { code: 'not_found', message: 'QR code not recognized' };
        }

        const pass = passSnap.data() as GatePass;

        switch (pass.status) {
          case 'inside': {
            // inside → exited (exit scan)
            await runTransaction(db, async (transaction) => {
              const freshSnap = await transaction.get(passRef);
              if (!freshSnap.exists()) throw new Error('Pass deleted');
              const freshData = freshSnap.data() as GatePass;

              if (freshData.status !== 'inside') {
                throw { code: 'not_inside', message: 'Visitor is not currently inside' };
              }

              transaction.update(passRef, {
                status: 'exited',
                timeOut: serverTimestamp(),
                exitDeviceId: uid,
              });
            });

            await addDoc(collection(db, 'visitLogs'), {
              passToken: passId,
              visitorId: pass.visitorId,
              event: 'scan_exit',
              reason: null,
              deviceId: uid,
              gate,
              guardUid: null,
              timestamp: serverTimestamp(),
            });

            setStatus('success');
            setStatusMessage('Exit recorded. Goodbye!');
            toast.success('Exit recorded successfully', {
              style: {
                backgroundColor: '#16a34a',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 'bold',
              },
            });
            break;
          }

          case 'issued':
            throw { code: 'not_entered', message: 'Visitor has not entered yet' };

          case 'pending':
            throw { code: 'pending', message: 'Entry is still pending approval' };

          case 'rejected':
            throw { code: 'rejected', message: 'This pass was rejected' };

          case 'exited':
            throw { code: 'already_exited', message: 'Visitor has already exited' };

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
        resetTimerRef.current = setTimeout(() => {
          setStatus('ready');
          setStatusMessage('Scan QR to exit');
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
    const scannerId = 'exit-qr-reader';

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
          () => {}
        );
      } catch (err) {
        console.error('QR scanner init error:', err);
      }
    }, 500);

    return () => {
      clearTimeout(initTimer);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      scannerRef.current?.stop().catch(() => {});
    };
  }, [processQR]);

  const statusConfig = {
    ready: {
      bg: 'var(--color-brand)',
      icon: <LogOutIcon className="h-8 w-8 text-white" />,
    },
    processing: {
      bg: 'var(--color-warning)',
      icon: <div className="h-8 w-8 animate-spin rounded-full border-3 border-white border-t-transparent" />,
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

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      <div className="mb-4 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-white/50">
          Exit Scanner
        </p>
        <p className="text-sm font-bold text-white">{gate}</p>
      </div>

      <div
        className="relative mb-6 aspect-square w-full max-w-sm overflow-hidden rounded-2xl"
        style={{ borderRadius: 'var(--radius-xl)' }}
      >
        <div id="exit-qr-reader" className="h-full w-full" />
      </div>

      <div
        className="flex items-center gap-3 rounded-xl px-6 py-3"
        style={{
          backgroundColor: config.bg,
          borderRadius: 'var(--radius-lg)',
          transition: 'background-color 200ms ease',
        }}
      >
        {config.icon}
        <span className="text-base font-semibold text-white">{statusMessage}</span>
      </div>

      {!device && (
        <div className="mt-6 flex items-center gap-2 rounded-md px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)' }}>
          <AlertTriangle className="h-4 w-4" />
          Device not registered. Contact admin.
        </div>
      )}
    </main>
  );
}

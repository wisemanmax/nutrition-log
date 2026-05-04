import React, { useEffect, useRef, useState } from 'react';
import { V } from '../utils/theme';
import { Btn } from './ui';

export function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let active = true;
    let codeReader = null;

    async function startScan() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        codeReader = new BrowserMultiFormatReader();
        readerRef.current = codeReader;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) { setError('No camera found'); return; }

        // Prefer rear camera
        const rearDevice = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];

        await codeReader.decodeFromVideoDevice(
          rearDevice.deviceId,
          videoRef.current,
          (result, err) => {
            if (!active) return;
            if (result) {
              setScanning(false);
              onResult(result.getText());
            }
          }
        );
      } catch (e) {
        if (active) setError('Camera access denied or unavailable');
      }
    }

    startScan();

    return () => {
      active = false;
      try { readerRef.current?.reset(); } catch {}
    };
  }, [onResult]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Camera viewport */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Scan overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Corner brackets */}
          {!error && (
            <div style={{ position: 'relative', width: 240, height: 160 }}>
              {[
                { top: 0, left: 0, borderTop: `3px solid ${V.accent}`, borderLeft: `3px solid ${V.accent}` },
                { top: 0, right: 0, borderTop: `3px solid ${V.accent}`, borderRight: `3px solid ${V.accent}` },
                { bottom: 0, left: 0, borderBottom: `3px solid ${V.accent}`, borderLeft: `3px solid ${V.accent}` },
                { bottom: 0, right: 0, borderBottom: `3px solid ${V.accent}`, borderRight: `3px solid ${V.accent}` },
              ].map((style, i) => (
                <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...style }} />
              ))}
              {/* Scan line */}
              {scanning && (
                <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${V.accent},transparent)`,
                  top: '50%', animation: 'scanLine 1.5s ease-in-out infinite' }} />
              )}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(0,0,0,0.8)', padding: '16px 24px', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
              <div style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>{error}</div>
            </div>
          )}
        </div>

        {/* Label */}
        <div style={{ position: 'absolute', bottom: 100, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 12 }}>
            {scanning ? 'Point at a barcode' : '✓ Barcode detected!'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.9)', display: 'flex', gap: 12 }}>
        <Btn v="secondary" full onClick={onClose}>Cancel</Btn>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}

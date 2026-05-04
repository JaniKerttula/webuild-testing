import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';

import { useI18n } from '../i18n.js';

type QrCodePanelProps = {
  value: string;
  alt: string;
};

export function QrCodePanel({ value, alt }: QrCodePanelProps) {
  const { t } = useI18n();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void toDataURL(value, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1f2529',
        light: '#ffffff',
      },
    }).then((nextDataUrl: string) => {
      if (isActive) {
        setDataUrl(nextDataUrl);
      }
    }).catch(() => {
      if (isActive) {
        setDataUrl(null);
      }
    });

    return () => {
      isActive = false;
    };
  }, [value]);

  return (
    <div className="qr-code-panel">
      {dataUrl ? (
        <img className="qr-code-image" src={dataUrl} alt={alt} />
      ) : (
        <div className="qr-code-placeholder">{t.common.generatingQrCode}</div>
      )}
      <details className="qr-code-value-disclosure">
        <summary>{t.common.showRawQrInput}</summary>
        <p className="qr-code-value">{value}</p>
      </details>
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';

type UseKeyboardBarcodeScannerOptions = {
  enabled: boolean;
  onScan: (barcode: string) => void | Promise<void>;
  onInvalidScan?: (rawValue: string) => void;
  minLength?: number;
  maxLength?: number;
  idleMs?: number;
  interKeyMaxMs?: number;
  captureInEditableTargets?: boolean;
  requireScannerLikeTiming?: boolean;
};

type HidCollectionLike = {
  usagePage?: number;
  usage?: number;
};

type HidDeviceLike = {
  productName?: string;
  collections?: HidCollectionLike[];
};

type HidApiLike = {
  getDevices?: () => Promise<HidDeviceLike[]>;
  addEventListener?: (
    type: 'connect' | 'disconnect',
    listener: EventListenerOrEventListenerObject
  ) => void;
  removeEventListener?: (
    type: 'connect' | 'disconnect',
    listener: EventListenerOrEventListenerObject
  ) => void;
};

type NavigatorWithHid = Navigator & { hid?: HidApiLike };

const HID_BARCODE_USAGE_PAGE = 0x8c;
const HID_2D_BARCODE_USAGE_PAGE = 0x8d;
const SCANNER_NAME_HINTS = [
  'scanner',
  'barcode',
  'code reader',
  'imager',
  'honeywell',
  'zebra',
  'datalogic',
  'newland',
  'symbol',
];

const DIGIT_KEY_CODE_TO_CHAR: Record<string, string> = {
  Digit0: '0',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  Numpad0: '0',
  Numpad1: '1',
  Numpad2: '2',
  Numpad3: '3',
  Numpad4: '4',
  Numpad5: '5',
  Numpad6: '6',
  Numpad7: '7',
  Numpad8: '8',
  Numpad9: '9',
};

const SHIFTED_DIGIT_SYMBOL_TO_CHAR: Record<string, string> = {
  ')': '0',
  '!': '1',
  '@': '2',
  '#': '3',
  '$': '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
};

export type KeyboardScannerConnectionSource = 'hid' | 'input';

export type KeyboardScannerConnection = {
  connected: boolean;
  source: KeyboardScannerConnectionSource | null;
  hidSupported: boolean;
};

const DEFAULT_MIN_LENGTH = 6;
const DEFAULT_MAX_LENGTH = 32;
const DEFAULT_IDLE_MS = 80;
const DEFAULT_INTER_KEY_MAX_MS = 85;

const normalizeDigitLikeChar = (char: string): string => {
  if (!char) return char;
  if (/^[0-9]$/.test(char)) return char;

  if (SHIFTED_DIGIT_SYMBOL_TO_CHAR[char]) {
    return SHIFTED_DIGIT_SYMBOL_TO_CHAR[char];
  }

  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return char;

  if (codePoint >= 0x0660 && codePoint <= 0x0669) {
    return String(codePoint - 0x0660);
  }
  if (codePoint >= 0x06f0 && codePoint <= 0x06f9) {
    return String(codePoint - 0x06f0);
  }
  if (codePoint >= 0xff10 && codePoint <= 0xff19) {
    return String(codePoint - 0xff10);
  }

  return char;
};

const normalizeScannerText = (value: string): string =>
  String(value || '')
    .split('')
    .map((char) => normalizeDigitLikeChar(char))
    .join('');

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;

  if (target.isContentEditable) return true;

  // Handles nested editable wrappers from component libraries.
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
  );
};

const isLikelyBarcodeHidDevice = (device: HidDeviceLike): boolean => {
  const lowerName = String(device.productName || '').toLowerCase();
  const hasNameHint = SCANNER_NAME_HINTS.some((hint) => lowerName.includes(hint));
  const hasBarcodeUsage = (device.collections || []).some((collection) => {
    const usagePage = Number(collection.usagePage || 0);
    return usagePage === HID_BARCODE_USAGE_PAGE || usagePage === HID_2D_BARCODE_USAGE_PAGE;
  });
  return hasNameHint || hasBarcodeUsage;
};

export const useKeyboardBarcodeScanner = ({
  enabled,
  onScan,
  onInvalidScan,
  minLength = DEFAULT_MIN_LENGTH,
  maxLength = DEFAULT_MAX_LENGTH,
  idleMs = DEFAULT_IDLE_MS,
  interKeyMaxMs = DEFAULT_INTER_KEY_MAX_MS,
  captureInEditableTargets = false,
  requireScannerLikeTiming = false,
}: UseKeyboardBarcodeScannerOptions) => {
  const [inputDetected, setInputDetected] = useState(false);
  const [hidDetected, setHidDetected] = useState(false);
  const hidSupported =
    typeof navigator !== 'undefined' &&
    typeof (navigator as NavigatorWithHid).hid?.getDevices === 'function';
  const bufferRef = useRef('');
  const lastKeyTimestampRef = useRef(0);
  const sequenceStartedAtRef = useRef(0);
  const sequenceStartedInEditableRef = useRef(false);
  const keyCountRef = useRef(0);
  const flushTimerRef = useRef<number | null>(null);
  const scanQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestOptionsRef = useRef({
    onScan,
    onInvalidScan,
    minLength,
    maxLength,
    idleMs,
    interKeyMaxMs,
    captureInEditableTargets,
    requireScannerLikeTiming,
  });

  useEffect(() => {
    latestOptionsRef.current = {
      onScan,
      onInvalidScan,
      minLength,
      maxLength,
      idleMs,
      interKeyMaxMs,
      captureInEditableTargets,
      requireScannerLikeTiming,
    };
  }, [
    onScan,
    onInvalidScan,
    minLength,
    maxLength,
    idleMs,
    interKeyMaxMs,
    captureInEditableTargets,
    requireScannerLikeTiming,
  ]);

  useEffect(() => {
    if (!hidSupported) return;

    const hid = (navigator as NavigatorWithHid).hid;
    if (!hid || typeof hid.getDevices !== 'function') return;
    let cancelled = false;

    const refreshHidStatus = async () => {
      try {
        const devices = await hid.getDevices?.();
        if (cancelled) return;
        const detected = (devices || []).some((device) => isLikelyBarcodeHidDevice(device));
        setHidDetected(detected);
      } catch {
        if (!cancelled) {
          setHidDetected(false);
        }
      }
    };

    void refreshHidStatus();

    const handleConnect = () => {
      void refreshHidStatus();
    };
    const handleDisconnect = () => {
      void refreshHidStatus();
    };

    hid.addEventListener?.('connect', handleConnect);
    hid.addEventListener?.('disconnect', handleDisconnect);

    return () => {
      cancelled = true;
      hid.removeEventListener?.('connect', handleConnect);
      hid.removeEventListener?.('disconnect', handleDisconnect);
    };
  }, [hidSupported]);

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = '';
      lastKeyTimestampRef.current = 0;
      sequenceStartedAtRef.current = 0;
      sequenceStartedInEditableRef.current = false;
      keyCountRef.current = 0;
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      return;
    }

    const enqueueScan = (value: string) => {
      scanQueueRef.current = scanQueueRef.current
        .then(async () => {
          await latestOptionsRef.current.onScan(value);
        })
        .catch(() => {
          // Swallow queue errors to keep subsequent scans processing.
        });
    };

    const clearBufferState = () => {
      bufferRef.current = '';
      lastKeyTimestampRef.current = 0;
      sequenceStartedAtRef.current = 0;
      sequenceStartedInEditableRef.current = false;
      keyCountRef.current = 0;
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };

    const flushBuffer = (trigger: 'idle' | 'terminator') => {
      const raw = normalizeScannerText(bufferRef.current).trim();
      const sequenceStartedAt = sequenceStartedAtRef.current;
      const lastKeyTimestamp = lastKeyTimestampRef.current;
      const sequenceStartedInEditable = sequenceStartedInEditableRef.current;
      const keyCount = keyCountRef.current;
      clearBufferState();

      if (!raw) return;

      if (raw.length < latestOptionsRef.current.minLength) {
        return;
      }

      if (raw.length > latestOptionsRef.current.maxLength) {
        latestOptionsRef.current.onInvalidScan?.(raw);
        return;
      }

      const durationMs =
        sequenceStartedAt > 0 && lastKeyTimestamp >= sequenceStartedAt
          ? lastKeyTimestamp - sequenceStartedAt
          : 0;
      const avgInterKeyMs = keyCount > 1 ? durationMs / (keyCount - 1) : Number.POSITIVE_INFINITY;
      const scannerSpeedThresholdMs = Math.max(
        22,
        Math.min(latestOptionsRef.current.interKeyMaxMs, 80)
      );
      const scannerLikeSpeed = avgInterKeyMs <= scannerSpeedThresholdMs;
      const looksLikeHardwareScan =
        keyCount >= Math.max(4, latestOptionsRef.current.minLength) &&
        scannerLikeSpeed &&
        (trigger === 'terminator' || keyCount >= 6);

      if (latestOptionsRef.current.requireScannerLikeTiming && !looksLikeHardwareScan) {
        return;
      }
      if (sequenceStartedInEditable && !looksLikeHardwareScan) {
        return;
      }

      if (looksLikeHardwareScan) {
        setInputDetected(true);
      }

      enqueueScan(raw);
    };

    const scheduleFlush = () => {
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = window.setTimeout(
        () => flushBuffer('idle'),
        latestOptionsRef.current.idleMs
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const editableTarget = isEditableTarget(event.target);
      if (editableTarget && !latestOptionsRef.current.captureInEditableTargets) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (bufferRef.current) {
          event.preventDefault();
          flushBuffer('terminator');
        }
        return;
      }

      if (event.key === 'Escape') {
        clearBufferState();
        return;
      }

      if (event.key.length !== 1) return;

      const normalizedKey =
        DIGIT_KEY_CODE_TO_CHAR[event.code] || normalizeDigitLikeChar(event.key);
      if (!normalizedKey || normalizedKey.length !== 1) return;

      const now = Date.now();
      const elapsed = now - lastKeyTimestampRef.current;
      if (elapsed > latestOptionsRef.current.interKeyMaxMs) {
        bufferRef.current = '';
        sequenceStartedAtRef.current = now;
        sequenceStartedInEditableRef.current = editableTarget;
        keyCountRef.current = 0;
      }

      if (!bufferRef.current) {
        sequenceStartedAtRef.current = now;
        sequenceStartedInEditableRef.current = editableTarget;
      }
      bufferRef.current += normalizedKey;
      keyCountRef.current += 1;
      lastKeyTimestampRef.current = now;
      scheduleFlush();
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      sequenceStartedAtRef.current = 0;
      sequenceStartedInEditableRef.current = false;
      keyCountRef.current = 0;
    };
  }, [enabled]);

  const connection: KeyboardScannerConnection = {
    connected: hidDetected || inputDetected,
    source: hidDetected ? 'hid' : inputDetected ? 'input' : null,
    hidSupported,
  };

  return { connection };
};

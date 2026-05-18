import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Scan,
  Flashlight,
  FlashlightOff,
  CheckCircle2,
  Plus,
  Package,
  Edit3,
  ShoppingCart,
  Volume2,
  VolumeX,
  Smartphone,
  Loader2,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { productsAPI, salesAPI, assistantAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useKeyboardBarcodeScanner } from '@/hooks/useKeyboardBarcodeScanner';
import { isCountMeasurementType, normalizeProductMeasurementType } from '@/constants/productMeasurements';
import type { Product } from '@/types';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string, product?: Product | null) => void;
  onCreateProduct?: (barcode: string) => void;
  mode?: 'quick-actions' | 'callback';
}

const getDiscountedUnitPrice = (product: Product) => {
  const basePrice = Number(product.price) || 0;
  const discountPercent = Math.max(0, Math.min(100, Number(product.soldDiscountPercent) || 0));
  const discounted = basePrice * (1 - discountPercent / 100);
  const secondPrice = Number(product.secondPrice);
  const effective =
    Number.isFinite(secondPrice) && secondPrice >= 0
      ? Math.max(discounted, secondPrice)
      : discounted;
  return Number(effective.toFixed(2));
};

const isSingleUnitCountInStock = (product: Pick<Product, 'measurementType' | 'quantity' | 'salesCount'>) =>
  isCountMeasurementType(normalizeProductMeasurementType(product.measurementType)) &&
  Number(product.quantity) === 1 &&
  Number(product.salesCount) === 0;

const isLowStockProduct = (product: Pick<Product, 'measurementType' | 'quantity' | 'minQuantity' | 'salesCount'>) => {
  const quantity = Number(product.quantity) || 0;
  const minQuantity = Number(product.minQuantity) || 0;
  if (quantity <= 0) return false;
  if (isSingleUnitCountInStock(product)) return false;
  return quantity <= minQuantity;
};

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  onCreateProduct,
  mode = 'quick-actions',
}) => {
  const { t } = useTranslation();
  const { canEdit, canManageSales, updateOnboarding } = useAuth();
  const descriptionId = "barcode-scanner-description";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerIdRef = useRef(
    `scanner-container-${Math.random().toString(36).slice(2, 10)}`
  );
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const scanLockRef = useRef(false);
  const recentScanRef = useRef<{ value: string; ts: number; count: number } | null>(null);
  const deliveredScanRef = useRef<{ value: string; ts: number } | null>(null);
  const aiAssistFailureCountRef = useRef(0);
  const aiAssistAttemptsRef = useRef(0);
  const aiAssistLastAttemptRef = useRef(0);
  const aiAssistInFlightRef = useRef(false);
  const aiAssistAutoTimerRef = useRef<number | null>(null);
  const aiAssistTimeoutRef = useRef<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScanned, setLastScanned] = useState<{ barcode: string; product?: Product } | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistError, setAiAssistError] = useState<string | null>(null);
  const [aiAssistResult, setAiAssistResult] = useState<{ barcode: string; note?: string } | null>(null);
  const DELIVERED_SCAN_DEDUP_MS = 3000;
  const AI_ASSIST_TRIGGER_FAILURES = 15;
  const AI_ASSIST_COOLDOWN_MS = 12000;
  const AI_ASSIST_MAX_ATTEMPTS = 3;
  const AI_ASSIST_AUTO_DELAY_MS = 3500;
  const AI_ASSIST_TIMEOUT_MS = 10000;
  const AI_ASSIST_RETRY_DELAY_MS = 1200;

  const clearAiAssistTimer = () => {
    if (aiAssistAutoTimerRef.current) {
      window.clearTimeout(aiAssistAutoTimerRef.current);
      aiAssistAutoTimerRef.current = null;
    }
  };

  const clearAiTimeout = () => {
    if (aiAssistTimeoutRef.current) {
      window.clearTimeout(aiAssistTimeoutRef.current);
      aiAssistTimeoutRef.current = null;
    }
  };

  const waitForAiAssistWindow = async (attemptStartedAt: number) => {
    const remaining = AI_ASSIST_TIMEOUT_MS - (Date.now() - attemptStartedAt);
    if (remaining > 0) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, remaining);
      });
    }
  };

  const resetAiAssistTracking = () => {
    aiAssistFailureCountRef.current = 0;
    aiAssistAttemptsRef.current = 0;
    aiAssistLastAttemptRef.current = 0;
    aiAssistInFlightRef.current = false;
    clearAiAssistTimer();
    clearAiTimeout();
    setAiAssistLoading(false);
    setAiAssistError(null);
    setAiAssistResult(null);
  };

  // Sound effect for scan success
  const playScanSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      window.setTimeout(() => {
        audioContext.close().catch(() => undefined);
      }, 200);
    } catch (error) {
      console.log('Audio not supported');
    }
  }, [soundEnabled]);

  // Vibration feedback
  const vibrate = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, []);

  useEffect(() => {
    let initTimer: number | null = null;
    if (isOpen) {
      // Delay init until dialog content is mounted.
      resetAiAssistTracking();
      scanLockRef.current = false;
      initTimer = window.setTimeout(() => {
        void initializeScanner();
      }, 0);
    } else {
      void stopScanner();
    }

    return () => {
      if (initTimer) {
        window.clearTimeout(initTimer);
      }
      void stopScanner();
    };
  }, [isOpen]);

  const initializeScanner = async () => {
    const containerId = scannerContainerIdRef.current;
    const containerElement =
      scannerContainerRef.current || document.getElementById(containerId);

    if (!containerElement) {
      if (isOpen) {
        window.setTimeout(() => {
          void initializeScanner();
        }, 60);
      }
      return;
    }

    try {
      // Ensure any previous instance is cleaned up
      if (scannerRef.current) {
        try {
          await stopScanner();
        } catch (err) {
          console.warn('Failed to stop previous scanner instance', err);
        }
      }

      setIsInitializing(true);
      setErrorMessage(null);

      if (!window.isSecureContext) {
        const host = window.location.hostname;
        const isLocalhost =
          host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
        if (!isLocalhost) {
          setErrorMessage(
            t(
              'scanner.secureContextError',
              'Camera access on mobile requires HTTPS. Please open the site over HTTPS or use a secure tunnel.'
            )
          );
          setIsInitializing(false);
          return;
        }
      }

      // Force permission prompt (especially on mobile) before listing cameras.
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        permissionStream.getTracks().forEach((track) => track.stop());
      } catch (permissionError) {
        console.error('Camera permission error:', permissionError);
        setErrorMessage(
          t(
            'scanner.permissionError',
            'Camera access failed. Please allow permissions and try again.'
          )
        );
        setIsInitializing(false);
        return;
      }

      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        // Prefer back camera on mobile
        const backCamera = cameras.find((cam) =>
          cam.label.toLowerCase().includes('back') ||
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        );
        const cameraId = backCamera ? backCamera.id : cameras[0].id;

        await scanner.start(
          cameraId,
          {
            fps: 24,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const width = Math.max(50, Math.min(360, Math.floor(viewfinderWidth * 0.8)));
              const height = Math.max(50, Math.min(220, Math.floor(viewfinderHeight * 0.4)));
              return { width, height };
            },
            aspectRatio: 1.777,
            disableFlip: false,
            videoConstraints: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              advanced: [{ focusMode: "continuous" } as any],
            },
          },
          onScanSuccess,
          onScanFailure
        );
        setIsScanning(true);
        scheduleAiAssist();
      }
    } catch (error) {
      console.error('Error initializing scanner:', error);
      setErrorMessage(t('scanner.permissionError', 'Camera access failed. Please allow permissions and try again.'));
    }
    setIsInitializing(false);
  };

  const stopScanner = async () => {
    if (!scannerRef.current) {
      setIsScanning(false);
      return;
    }

    const scanner = scannerRef.current;
    scannerRef.current = null;

    try {
      // Always attempt to stop; relying on React state here can race on first decode.
      await scanner.stop();
    } catch (error) {
      console.debug('Scanner stop skipped:', error);
    }

    try {
      await scanner.clear();
    } catch (error) {
      console.error('Error clearing scanner:', error);
    }

    setIsScanning(false);
  };

  const isAllDigits = (value: string) => /^[0-9]+$/.test(value);

  const isValidEan13 = (value: string) => {
    if (value.length !== 13 || !isAllDigits(value)) return false;
    const digits = value.split("").map((d) => parseInt(d, 10));
    const check = digits.pop() as number;
    const sum = digits.reduce((acc, digit, index) => {
      const weight = index % 2 === 0 ? 1 : 3;
      return acc + digit * weight;
    }, 0);
    const expected = (10 - (sum % 10)) % 10;
    return check === expected;
  };

  const isValidEan8 = (value: string) => {
    if (value.length !== 8 || !isAllDigits(value)) return false;
    const digits = value.split("").map((d) => parseInt(d, 10));
    const check = digits.pop() as number;
    const sum = digits.reduce((acc, digit, index) => {
      const weight = index % 2 === 0 ? 3 : 1;
      return acc + digit * weight;
    }, 0);
    const expected = (10 - (sum % 10)) % 10;
    return check === expected;
  };

  const isValidUpcA = (value: string) => {
    if (value.length !== 12 || !isAllDigits(value)) return false;
    const digits = value.split("").map((d) => parseInt(d, 10));
    const check = digits.pop() as number;
    const sum = digits.reduce((acc, digit, index) => {
      const weight = index % 2 === 0 ? 3 : 1;
      return acc + digit * weight;
    }, 0);
    const expected = (10 - (sum % 10)) % 10;
    return check === expected;
  };

  const shouldAcceptScan = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return false;

    if (isValidEan13(normalized) || isValidEan8(normalized) || isValidUpcA(normalized)) {
      recentScanRef.current = null;
      return true;
    }

    const now = Date.now();
    const last = recentScanRef.current;
    if (last && last.value === normalized && now - last.ts <= 700) {
      last.count += 1;
      last.ts = now;
      if (last.count >= 2) {
        recentScanRef.current = null;
        return true;
      }
      return false;
    }

    recentScanRef.current = { value: normalized, ts: now, count: 1 };
    return false;
  };

  const isValidBarcodeFormat = (value: string) =>
    isValidEan13(value) || isValidEan8(value) || isValidUpcA(value);

  const extractBarcodeCandidate = (text: string) => {
    const normalized = String(text || '').replace(/\s+/g, ' ');
    const explicit = normalized.match(/\b(?:barcode|code)\s*[:#-]?\s*([0-9]{8,14})\b/i);
    if (explicit?.[1]) return explicit[1];
    const plainDigits = normalized.match(/\b([0-9]{8,14})\b/);
    return plainDigits?.[1] || null;
  };

  // Capture one frame from the camera stream so AI can decode hard-to-scan barcodes.
  const captureFrameAsBase64 = () => {
    const video = scannerContainerRef.current?.querySelector('video') as HTMLVideoElement | null;
    if (!video || video.readyState < 2) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('canvas_not_supported');
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    if (!base64) {
      throw new Error('capture_failed');
    }
    return base64;
  };

  const processScan = async (decodedText: string, bypassValidation = false) => {
    const normalizedText = String(decodedText || '').trim();
    if (!normalizedText) return;
    if (scanLockRef.current || scanSuccess || showQuickActions) return; // Prevent multiple scans

    const now = Date.now();
    const delivered = deliveredScanRef.current;
    if (delivered && delivered.value === normalizedText && now - delivered.ts <= DELIVERED_SCAN_DEDUP_MS) {
      return;
    }

    if (!bypassValidation && !shouldAcceptScan(normalizedText)) return;
    aiAssistFailureCountRef.current = 0;
    scanLockRef.current = true;
    deliveredScanRef.current = { value: normalizedText, ts: now };
    clearAiAssistTimer();
    
    setScanSuccess(true);
    await stopScanner();
    playScanSound();
    vibrate();

    try {
      // Try to find product by barcode
      const response = await productsAPI.getProductByBarcode(normalizedText);
      const product = response.data.product;

      if (mode === 'quick-actions') {
        setLastScanned({ barcode: normalizedText, product });
        setShowQuickActions(true);
      }
      onScan(normalizedText, product ?? null);

      // Update onboarding if first scan
      updateOnboarding({ scannedFirstBarcode: true });
    } catch (error) {
      if (mode === 'quick-actions') {
        setLastScanned({ barcode: normalizedText });
        setShowQuickActions(true);
      }
      onScan(normalizedText, null);
    }

    // Reset scan success after delay
    setTimeout(() => {
      setScanSuccess(false);
    }, 2000);

    if (mode === 'callback') {
      handleClose();
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    processScan(decodedText);
  };

  const onScanFailure = () => {
    if (scanLockRef.current || aiAssistInFlightRef.current || !scannerRef.current) return;

    aiAssistFailureCountRef.current += 1;

    const shouldTryAi =
      aiAssistFailureCountRef.current >= AI_ASSIST_TRIGGER_FAILURES &&
      aiAssistAttemptsRef.current < AI_ASSIST_MAX_ATTEMPTS &&
      Date.now() - aiAssistLastAttemptRef.current >= AI_ASSIST_COOLDOWN_MS;

    if (shouldTryAi) {
      void runAiAssist();
    }
  };

  const toggleFlashlight = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      
      if (capabilities.torch) {
        const newState = !flashlightOn;
        await track.applyConstraints({
          advanced: [{ torch: newState } as any],
        });
        setFlashlightOn(newState);
      }
    } catch (error) {
      console.error('Flashlight not supported:', error);
    }
  };

  const handleManualSubmit = () => {
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    setManualBarcode('');
    processScan(trimmed, true);
  };

  useKeyboardBarcodeScanner({
    enabled: isOpen && !showQuickActions,
    onScan: async (rawBarcode) => {
      const trimmed = rawBarcode.trim();
      if (!trimmed) return;
      setErrorMessage(null);
      setManualBarcode('');
      await processScan(trimmed, true);
    },
    onInvalidScan: () => {
      setErrorMessage(
        t('scanner.invalidBarcode', 'Invalid barcode input. Please try again.')
      );
    },
    minLength: 4,
    maxLength: 32,
  });

  async function runAiAssist(ignoreCooldown = false) {
    if (
      aiAssistInFlightRef.current ||
      (!isScanning && !scannerRef.current) ||
      errorMessage ||
      scanLockRef.current ||
      aiAssistAttemptsRef.current >= AI_ASSIST_MAX_ATTEMPTS
    ) {
      return;
    }

    const now = Date.now();
    if (!ignoreCooldown && now - aiAssistLastAttemptRef.current < AI_ASSIST_COOLDOWN_MS) return;

    aiAssistInFlightRef.current = true;
    aiAssistLastAttemptRef.current = now;
    aiAssistAttemptsRef.current += 1;
    aiAssistFailureCountRef.current = 0;
    setAiAssistError(null);
    setAiAssistResult(null);
    setAiAssistLoading(true);
    const attemptStartedAt = now;
    let nextDelay: number | null = AI_ASSIST_COOLDOWN_MS;
    let bypassCooldownForRetry = false;

    try {
      const failAndRetry = async () => {
        await waitForAiAssistWindow(attemptStartedAt);
        if (scanLockRef.current) return;
        setAiAssistError(
          t('scanner.aiNoBarcode', 'AI could not detect a clear barcode. Hold steady and try again.')
        );
        nextDelay = AI_ASSIST_RETRY_DELAY_MS;
        bypassCooldownForRetry = true;
      };

      const contentBase64 = captureFrameAsBase64();
      if (!contentBase64) {
        await failAndRetry();
        return;
      }

      clearAiTimeout();
      const analyzeOutcome = await Promise.race<
        | { type: 'response'; response: Awaited<ReturnType<typeof assistantAPI.analyze>> }
        | { type: 'error'; error: unknown }
        | { type: 'timeout' }
      >([
        assistantAPI
          .analyze({
            fileName: 'barcode-frame.jpg',
            mimeType: 'image/jpeg',
            contentBase64,
            question:
              'Read the main product barcode from this image. Return the first line exactly as: barcode: <digits>. Then add one short sentence.'
          })
          .then((response) => ({ type: 'response' as const, response }))
          .catch((error) => ({ type: 'error' as const, error })),
        new Promise<{ type: 'timeout' }>((resolve) => {
          aiAssistTimeoutRef.current = window.setTimeout(() => {
            resolve({ type: 'timeout' });
          }, AI_ASSIST_TIMEOUT_MS);
        }),
      ]);
      clearAiTimeout();

      if (analyzeOutcome.type === 'timeout') {
        await failAndRetry();
        return;
      }

      if (analyzeOutcome.type === 'error') {
        console.error('AI scanner assist failed:', analyzeOutcome.error);
        await failAndRetry();
        return;
      }

      const reply = String(analyzeOutcome.response?.data?.reply || '').trim();
      const candidate = extractBarcodeCandidate(reply);

      if (!candidate || !isValidBarcodeFormat(candidate)) {
        await failAndRetry();
        return;
      }

      setAiAssistResult({
        barcode: candidate,
        note: reply.slice(0, 220)
      });
      nextDelay = null;
      await processScan(candidate, true);
    } catch (error) {
      console.error('AI scanner assist failed:', error);
      await waitForAiAssistWindow(attemptStartedAt);
      if (!scanLockRef.current) {
        setAiAssistError(
          t('scanner.aiNoBarcode', 'AI could not detect a clear barcode. Hold steady and try again.')
        );
        nextDelay = AI_ASSIST_RETRY_DELAY_MS;
        bypassCooldownForRetry = true;
      }
    } finally {
      aiAssistInFlightRef.current = false;
      setAiAssistLoading(false);
      clearAiTimeout();
      if (
        nextDelay !== null &&
        !scanLockRef.current &&
        (isScanning || scannerRef.current)
      ) {
        scheduleAiAssist(nextDelay, bypassCooldownForRetry);
      }
    }
  }

  function scheduleAiAssist(delay = AI_ASSIST_AUTO_DELAY_MS, ignoreCooldown = false) {
    const scanningActive = isScanning || Boolean(scannerRef.current);
    if (!scanningActive || showQuickActions || errorMessage || scanLockRef.current) return;
    if (aiAssistAttemptsRef.current >= AI_ASSIST_MAX_ATTEMPTS) return;

    clearAiAssistTimer();
    aiAssistAutoTimerRef.current = window.setTimeout(() => {
      if (aiAssistInFlightRef.current || scanLockRef.current) return;
      void runAiAssist(ignoreCooldown);
    }, delay);
  }

  useEffect(() => {
    return () => {
      clearAiAssistTimer();
      clearAiTimeout();
    };
  }, []);

  const handleQuickAction = (action: string) => {
    if (!lastScanned) return;

    switch (action) {
      case 'add_stock':
        if (lastScanned.product) {
          productsAPI.updateStock(lastScanned.product._id, 1, 'add');
        }
        break;
      case 'sell':
        if (lastScanned.product && canManageSales()) {
          salesAPI.quickSale({
            productId: lastScanned.product._id,
            quantity: 1,
            unitPrice: getDiscountedUnitPrice(lastScanned.product),
          });
        }
        break;
      case 'edit':
        if (lastScanned.product) {
          onScan(lastScanned.barcode, lastScanned.product);
          onClose();
        }
        break;
      case 'create':
        onCreateProduct?.(lastScanned.barcode);
        onClose();
        break;
    }
    
    setShowQuickActions(false);
    setLastScanned(null);
  };

  const handleClose = () => {
    void stopScanner();
    setShowQuickActions(false);
    setLastScanned(null);
    setScanSuccess(false);
    resetAiAssistTracking();
    recentScanRef.current = null;
    onClose();
  };

  const handleResumeScanning = () => {
    setShowQuickActions(false);
    setLastScanned(null);
    setScanSuccess(false);
    resetAiAssistTracking();
    scanLockRef.current = false;
    recentScanRef.current = null;
    if (!isScanning) {
      initializeScanner();
    } else {
      scheduleAiAssist();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent
        className="max-w-lg p-0 overflow-hidden"
        showCloseButton={false}
        aria-describedby={descriptionId}
      >
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Scan className="w-5 h-5" />
              {t('scanner.title', 'Scan Barcode')}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFlashlight}>
                {flashlightOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription id={descriptionId} className="sr-only">
            {t('scanner.description', 'Scan a product barcode to find or create items.')}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {/* Scanner View */}
          <div
            ref={scannerContainerRef}
            id={scannerContainerIdRef.current}
            className="scanner-container w-full h-[400px] bg-black relative"
          />

          {/* Scan overlay */}
          {!showQuickActions && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Darken outside the scan area */}
              <div className="absolute inset-0">
                <div className="absolute inset-x-0 top-0 h-1/4 bg-black/35" />
                <div className="absolute inset-x-0 bottom-0 h-1/4 bg-black/35" />
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1/4 bg-black/35" />
                <div className="absolute right-0 top-1/4 bottom-1/4 w-1/4 bg-black/35" />
              </div>

              {isInitializing && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="text-white text-sm flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    {t('scanner.initializing', 'Starting camera...')}
                  </div>
                </div>
              )}
              {errorMessage && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6">
                  <div className="text-center text-white space-y-3">
                    <p className="text-sm">{errorMessage}</p>
                    <Button
                      variant="secondary"
                      className="pointer-events-auto"
                      onClick={initializeScanner}
                    >
                      {t('scanner.retry', 'Try Again')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Corner markers */}
              <div className="absolute top-1/4 left-1/4 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
              <div className="absolute top-1/4 right-1/4 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-1/4 left-1/4 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-1/4 right-1/4 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />
              
              {/* Scan line animation */}
              <motion.div
                className="absolute left-1/4 right-1/4 h-0.5 bg-primary shadow-lg"
                animate={{
                  top: ['25%', '75%', '25%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{
                  boxShadow: '0 0 10px 2px rgba(var(--primary), 0.5)',
                }}
              />

              {/* Instructions */}
              <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-white/80 text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                  {t('scanner.instruction', 'Position barcode within the frame')}
                </p>
              </div>
            </div>
          )}

          {/* Quick Actions Overlay */}
          <AnimatePresence>
            {showQuickActions && lastScanned && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6"
              >
                {lastScanned.product ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4"
                    >
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </motion.div>
                    
                    <h3 className="text-lg font-semibold mb-1">
                      {lastScanned.product.name}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-2">
                      SKU: {lastScanned.product.sku || '-'}
                    </p>
                    <Badge variant={isLowStockProduct(lastScanned.product) ? 'destructive' : 'default'}>
                      {isSingleUnitCountInStock(lastScanned.product)
                        ? t('inventory.singleUnitStock', '1 of 1')
                        : lastScanned.product.quantity}{' '}
                      {t('scanner.inStock', 'in stock')}
                    </Badge>

                    <div className="grid grid-cols-3 gap-3 mt-6 w-full">
                      {canEdit() && (
                        <Button
                          variant="outline"
                          className="flex flex-col items-center py-4 h-auto"
                          onClick={() => handleQuickAction('add_stock')}
                        >
                          <Plus className="w-5 h-5 mb-1" />
                          <span className="text-xs">{t('scanner.addStock', 'Add Stock')}</span>
                        </Button>
                      )}
                      {canManageSales() && (
                        <Button
                          variant="outline"
                          className="flex flex-col items-center py-4 h-auto"
                          onClick={() => handleQuickAction('sell')}
                        >
                          <ShoppingCart className="w-5 h-5 mb-1" />
                          <span className="text-xs">{t('scanner.sell', 'Sell')}</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="flex flex-col items-center py-4 h-auto"
                        onClick={() => handleQuickAction('edit')}
                      >
                        <Edit3 className="w-5 h-5 mb-1" />
                        <span className="text-xs">{t('scanner.edit', 'Edit')}</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4"
                    >
                      <Package className="w-8 h-8 text-orange-500" />
                    </motion.div>
                    
                    <h3 className="text-lg font-semibold mb-1">
                      {t('scanner.productNotFound', 'Product Not Found')}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 text-center">
                      {t('scanner.barcodeNotFound', 'No product found with barcode:')}
                      <br />
                      <code className="bg-muted px-2 py-1 rounded mt-1 inline-block">
                        {lastScanned.barcode}
                      </code>
                    </p>

                    {canEdit() && (
                      <Button
                        className="w-full mb-3"
                        onClick={() => handleQuickAction('create')}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('scanner.createProduct', 'Create Product')}
                      </Button>
                    )}
                  </>
                )}

                <Button
                  variant="ghost"
                  className="mt-2"
                  onClick={handleResumeScanning}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  {t('scanner.scanAgain', 'Scan Another')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Manual entry */}
        <div className="p-4 border-t flex gap-2 items-center flex-wrap">
          <input
            className="flex-1 h-10 px-3 rounded-md border bg-background text-sm"
            placeholder={t('scanner.manualPlaceholder', 'Enter barcode manually')}
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualSubmit();
              }
            }}
          />
          <Button onClick={handleManualSubmit} disabled={!manualBarcode.trim()}>
            {t('scanner.lookup', 'Lookup')}
          </Button>
        </div>

        {(aiAssistLoading || aiAssistResult || aiAssistError) && (
          <div className="px-4 pb-1 space-y-2">
            {aiAssistLoading && (
              <div className="rounded-md border border-blue-200 bg-blue-50 text-blue-800 p-3 text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('scanner.aiRunning', 'AI assist is trying to read the barcode...')}</span>
              </div>
            )}
            {aiAssistResult && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1">
                  {t('scanner.aiFound', 'AI Auto Result')}
                </p>
                <p className="font-mono text-sm">{aiAssistResult.barcode}</p>
                {aiAssistResult.note ? (
                  <p className="text-xs mt-1 text-emerald-900/80">{aiAssistResult.note}</p>
                ) : null}
              </div>
            )}
            {aiAssistError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
                {aiAssistError}
              </div>
            )}
          </div>
        )}

        {/* Mobile hint */}
        <div className="p-4 bg-muted/50 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Smartphone className="w-4 h-4" />
          <span>{t('scanner.mobileHint', 'For best results, use on a mobile device')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;

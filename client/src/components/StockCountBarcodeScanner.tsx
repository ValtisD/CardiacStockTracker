import { useState, useRef, useEffect } from "react";
import { Camera, X, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useTranslation } from 'react-i18next';

interface StockCountBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcodeData: string) => Promise<void>;
}

export function StockCountBarcodeScanner({ 
  isOpen, 
  onClose, 
  onScan
}: StockCountBarcodeScannerProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string>('');
  const [scanCount, setScanCount] = useState(0);
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(-1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastDetectedRef = useRef<string>('');
  const lastDetectionTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetScanner();
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async (cameraIndex?: number) => {
    setIsScanning(true);
    setError('');
    
    lastDetectedRef.current = '';
    lastDetectionTimeRef.current = 0;
    isProcessingRef.current = false;
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      const targetCameraIndex = cameraIndex !== undefined ? cameraIndex : 
                                (currentCameraIndex >= 0 ? currentCameraIndex : 
                                (videoDevices.length > 1 ? videoDevices.length - 1 : 0));
      
      setCurrentCameraIndex(targetCameraIndex);
      
      const constraints: MediaStreamConstraints = {
        video: videoDevices.length > 0 && videoDevices[targetCameraIndex]
          ? { deviceId: { exact: videoDevices[targetCameraIndex].deviceId } }
          : { facingMode: 'environment' }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        
        if (!codeReaderRef.current) {
          codeReaderRef.current = new BrowserMultiFormatReader();
        }
        
        await codeReaderRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result, error) => {
            if (result) {
              const now = Date.now();
              const barcode = result.getText();
              
              // Prevent duplicate scans within 2 seconds
              if (
                barcode !== lastDetectedRef.current ||
                now - lastDetectionTimeRef.current > 2000
              ) {
                if (!isProcessingRef.current) {
                  isProcessingRef.current = true;
                  lastDetectedRef.current = barcode;
                  lastDetectionTimeRef.current = now;
                  
                  await handleScan(barcode);
                  
                  // Allow next scan after 500ms
                  setTimeout(() => {
                    isProcessingRef.current = false;
                  }, 500);
                }
              }
            }
          }
        );
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError(t('barcode.cameraAccessDenied'));
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  const switchCamera = async () => {
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    stopCamera();
    await startCamera(nextIndex);
  };

  const resetScanner = () => {
    setLastScanned('');
    setScanCount(0);
    setError('');
    setIsProcessing(false);
    lastDetectedRef.current = '';
    lastDetectionTimeRef.current = 0;
    isProcessingRef.current = false;
  };

  const handleScan = async (barcode: string) => {
    setIsProcessing(true);
    setError('');
    
    try {
      await onScan(barcode);
      setLastScanned(barcode);
      setScanCount(prev => prev + 1);
      
      // Brief success indicator
      setTimeout(() => {
        setLastScanned('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || t('stockCount.errors.scanFailed'));
      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t("stockCount.actions.scanBarcode")}</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" data-testid="badge-scan-count">
                {t("stockCount.labels.scannedItems")}: {scanCount}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-close-scanner"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera controls */}
          <div className="flex gap-2">
            {!isScanning ? (
              <Button
                onClick={() => startCamera()}
                className="flex-1"
                data-testid="button-start-camera"
              >
                <Camera className="mr-2 h-4 w-4" />
                {t('barcode.startCamera')}
              </Button>
            ) : (
              <>
                <Button
                  onClick={stopCamera}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-stop-camera"
                >
                  {t('barcode.stopCamera')}
                </Button>
                {availableCameras.length > 1 && (
                  <Button
                    onClick={switchCamera}
                    variant="outline"
                    size="icon"
                    data-testid="button-switch-camera"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Video feed */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              data-testid="video-scanner"
            />
            
            {/* Scanning overlay */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-primary rounded-lg" />
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Processing...</span>
              </div>
            )}

            {/* Success indicator */}
            {lastScanned && !isProcessing && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Item added!</span>
              </div>
            )}

            {/* Error indicator */}
            {error && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-full text-sm font-medium max-w-xs text-center">
                {error}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">{t('barcode.instructions')}:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Position barcode within the frame</li>
              <li>Items are added automatically after scanning</li>
              <li>Keep scanning to add multiple items</li>
              <li>Click "Done" when finished</li>
            </ul>
          </div>

          {/* Done button */}
          <Button
            onClick={onClose}
            className="w-full"
            variant="default"
            data-testid="button-done-scanning"
          >
            Done ({scanCount} items scanned)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

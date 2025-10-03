import { useState, useRef, useEffect } from "react";
import { Camera, Scan, X, CheckCircle, Upload, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { parseGS1Barcode, formatGS1Display, isGS1Barcode, GS1Data } from "@/lib/gs1Parser";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (barcode: string, productInfo?: Product, gs1Data?: GS1Data) => void;
  title?: string;
}

export default function BarcodeScanner({ 
  isOpen, 
  onClose, 
  onScanComplete, 
  title = "Scan Barcode" 
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [productInfo, setProductInfo] = useState<Product | null>(null);
  const [gs1Data, setGs1Data] = useState<GS1Data | null>(null);
  const [error, setError] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [showInventoryUpdate, setShowInventoryUpdate] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [quantityAdjustment, setQuantityAdjustment] = useState<string>('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastDetectedRef = useRef<string>('');
  const lastDetectionTimeRef = useRef<number>(0);
  const isScanningActiveRef = useRef<boolean>(false);
  const detectionEnabledRef = useRef<boolean>(false);
  const detectionDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: inventoryData } = useQuery<Array<{ id: string; productId: string; location: string; quantity: number; product: Product }>>({
    queryKey: ['/api/inventory'],
    enabled: !!productInfo && showInventoryUpdate,
  });

  const updateInventoryMutation = useMutation({
    mutationFn: async (data: { productId: string; location: string; quantity: number }) => {
      return await apiRequest('PATCH', `/api/inventory/${data.productId}/${data.location}`, { quantity: data.quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] });
      setShowInventoryUpdate(false);
      setQuantityAdjustment('');
      setSelectedLocation('');
    },
  });

  const searchProduct = async (query: string) => {
    setIsSearching(true);
    setError('');
    
    // Parse GS1 barcode if applicable
    let parsedData: GS1Data | null = null;
    let searchQuery = query;
    
    if (isGS1Barcode(query)) {
      parsedData = parseGS1Barcode(query);
      setGs1Data(parsedData);
      
      // Use GTIN for product lookup if available
      if (parsedData.gtin) {
        searchQuery = parsedData.gtin;
        console.log('GS1 barcode detected. Using GTIN for search:', searchQuery);
        console.log('Extracted data:', {
          expirationDate: parsedData.expirationDate,
          serialNumber: parsedData.serialNumber,
          lotNumber: parsedData.lotNumber
        });
      }
    } else {
      // Clear GS1 data for non-GS1 barcodes to prevent stale data
      setGs1Data(null);
      console.log('Non-GS1 barcode, searching with full barcode:', query);
    }
    
    try {
      const response = await fetch(`/api/products/search/${encodeURIComponent(searchQuery)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Product not found. Please check the barcode or try manual entry.');
          setProductInfo(null);
        } else {
          setError('Failed to search for product. Please try again.');
        }
        return;
      }
      
      const products = await response.json();
      if (products && products.length > 0) {
        setProductInfo(products[0]);
      } else {
        setError('Product not found. Please check the barcode or try manual entry.');
        setProductInfo(null);
      }
    } catch (err) {
      console.error('Error searching for product:', err);
      setError('Failed to connect to server. Please try again.');
      setProductInfo(null);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    // Clean up barcode reader and media stream when component unmounts or dialog closes
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    // Reset scanner state when dialog opens
    if (isOpen) {
      // resetScanner now handles stopping the camera and clearing all state
      resetScanner();
    }
  }, [isOpen]);

  const startCamera = async (cameraIndex?: number) => {
    setIsScanning(true);
    setError('');
    
    // Clear any previous barcode detection state
    lastDetectedRef.current = '';
    lastDetectionTimeRef.current = 0;
    
    // Stop any existing stream before starting a new one
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    try {
      console.log('Starting camera for barcode scanning...');
      
      // ALWAYS create a fresh barcode reader to prevent callback contamination from previous scans
      // First, clean up any existing reader
      if (codeReaderRef.current) {
        try {
          // @ts-ignore - reset method exists but isn't in types
          codeReaderRef.current.reset();
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Create new reader instance for this scan
      codeReaderRef.current = new BrowserMultiFormatReader();
      // Set scan timing for better performance (300ms between scans)
      // @ts-ignore - timeBetweenScansMillis exists but isn't in types
      codeReaderRef.current.timeBetweenScansMillis = 300;
      
      // Get available video devices (static method)
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        setError('No camera found on this device.');
        setIsScanning(false);
        return;
      }
      
      setAvailableCameras(videoInputDevices);
      
      let selectedDeviceId: string;
      
      let cameraIndexToUse: number;
      
      if (cameraIndex !== undefined && videoInputDevices[cameraIndex]) {
        // Use specified camera (from switch button)
        cameraIndexToUse = cameraIndex;
        console.log('Using selected camera:', videoInputDevices[cameraIndex].label);
      } else if (currentCameraIndex >= 0 && currentCameraIndex < videoInputDevices.length) {
        // Reuse previously selected camera
        cameraIndexToUse = currentCameraIndex;
        console.log('Reusing previous camera:', videoInputDevices[currentCameraIndex].label);
      } else {
        // First time: prefer back/rear/environment camera
        // Try multiple detection methods for better reliability
        const backCameraIndex = videoInputDevices.findIndex((device: MediaDeviceInfo) => {
          const label = device.label.toLowerCase();
          return label.includes('back') || 
                 label.includes('rear') ||
                 label.includes('rück') || // German
                 label.includes('trasera') || // Spanish
                 label.includes('arrière') || // French
                 label.includes('environment');
        });
        
        if (backCameraIndex !== -1) {
          cameraIndexToUse = backCameraIndex;
          console.log('Found back camera:', videoInputDevices[backCameraIndex].label);
        } else if (videoInputDevices.length > 1) {
          // On mobile, back camera is usually the last one
          cameraIndexToUse = videoInputDevices.length - 1;
          console.log('Using last camera (likely back):', videoInputDevices[cameraIndexToUse].label);
        } else {
          // Only one camera available
          cameraIndexToUse = 0;
          console.log('Using only available camera:', videoInputDevices[0].label);
        }
      }
      
      setCurrentCameraIndex(cameraIndexToUse);
      selectedDeviceId = videoInputDevices[cameraIndexToUse].deviceId;
      
      // Set high resolution video constraints for better barcode detection
      const constraints = {
        video: {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: 'continuous' as any,
          aspectRatio: { ideal: 16/9 }
        }
      };
      
      // Get media stream with high resolution
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Mark scanning as active
        isScanningActiveRef.current = true;
        
        // Disable detection initially to prevent detecting old barcodes
        detectionEnabledRef.current = false;
        
        // Start continuous decoding
        // Reader is configured with 300ms between scans for better performance
        await codeReaderRef.current.decodeFromVideoElement(
          videoRef.current,
          (result) => {
            // Immediately check if scanning is still active
            if (!isScanningActiveRef.current) {
              return; // Camera was stopped, ignore this callback
            }
            
            // Check if detection is enabled (after delay)
            if (!detectionEnabledRef.current) {
              return; // Detection not yet enabled, ignore
            }
            
            if (result) {
              const barcode = result.getText();
              handleBarcodeDetected(barcode);
            }
          }
        );
        
        console.log('Camera started, waiting 1.2s before enabling barcode detection...');
        
        // Enable detection after a delay to give user time to move camera from previous barcode
        detectionDelayTimeoutRef.current = setTimeout(() => {
          detectionEnabledRef.current = true;
          console.log('Barcode detection enabled');
        }, 1200);
      } else {
        // Component unmounted before stream could be attached - clean up
        stream.getTracks().forEach(track => track.stop());
        console.log('Component unmounted, stream cleaned up');
        setIsScanning(false);
      }
      
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please use manual entry or check camera permissions in your browser settings.');
      setIsScanning(false);
      
      // Clean up any partially initialized stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  };

  const switchCamera = async () => {
    if (availableCameras.length <= 1) {
      console.log('Only one camera available, cannot switch');
      return;
    }
    
    console.log('Switching camera from index:', currentCameraIndex);
    
    // Calculate next camera index
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    console.log('Switching to camera index:', nextIndex);
    
    // Stop current camera and wait for cleanup
    stopCamera();
    
    // Wait a bit for proper cleanup, then start new camera
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Start camera with new index
    await startCamera(nextIndex);
  };

  const stopCamera = () => {
    // Immediately mark scanning as inactive to stop all callbacks
    isScanningActiveRef.current = false;
    detectionEnabledRef.current = false;
    
    // Clear detection delay timeout if it exists
    if (detectionDelayTimeoutRef.current) {
      clearTimeout(detectionDelayTimeoutRef.current);
      detectionDelayTimeoutRef.current = null;
    }
    
    // Stop the code reader
    if (codeReaderRef.current) {
      try {
        // @ts-ignore - reset method exists but isn't in types
        codeReaderRef.current.reset();
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Stop all media stream tracks to release camera
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped camera track:', track.kind);
      });
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    console.log('Camera stopped');
  };

  const simulateScan = () => {
    // Removed simulation - users should use manual entry
    setError('Please use manual entry to input barcode numbers.');
  };

  const handleBarcodeDetected = async (barcode: string) => {
    const now = Date.now();
    
    // Prevent multiple rapid detections of the same barcode
    if (isProcessingRef.current) {
      console.log('Already processing, ignoring duplicate');
      return;
    }
    
    // Ignore if same barcode detected within last 2 seconds
    if (lastDetectedRef.current === barcode && now - lastDetectionTimeRef.current < 2000) {
      console.log('Duplicate barcode within 2s, ignoring');
      return;
    }
    
    isProcessingRef.current = true;
    lastDetectedRef.current = barcode;
    lastDetectionTimeRef.current = now;
    
    // Stop camera first to prevent more detections
    stopCamera();
    
    setScannedCode(barcode);
    console.log('Barcode detected:', barcode);
    
    await searchProduct(barcode);
    
    // Reset processing flag
    isProcessingRef.current = false;
  };

  const handleManualEntry = () => {
    if (manualCode.trim()) {
      handleBarcodeDetected(manualCode.trim());
      setManualCode('');
    }
  };

  const handleConfirm = () => {
    if (scannedCode) {
      onScanComplete(scannedCode, productInfo || undefined, gs1Data || undefined);
      resetScanner();
      onClose();
    }
  };

  const handleInventoryUpdate = () => {
    if (!productInfo || !selectedLocation || !quantityAdjustment) return;
    
    const currentInventory = inventoryData?.find(
      inv => inv.productId === productInfo.id && inv.location === selectedLocation
    );
    
    const currentQuantity = currentInventory?.quantity || 0;
    const adjustment = parseInt(quantityAdjustment);
    const newQuantity = currentQuantity + adjustment;
    
    if (newQuantity < 0) {
      setError('Cannot set quantity below zero');
      return;
    }
    
    updateInventoryMutation.mutate({
      productId: productInfo.id,
      location: selectedLocation,
      quantity: newQuantity,
    });
  };

  const resetScanner = () => {
    // Stop camera first to ensure clean state
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Clear all state
    setScannedCode('');
    setProductInfo(null);
    setGs1Data(null);
    setManualCode('');
    setError('');
    setIsScanning(false);
    setIsSearching(false);
    setShowInventoryUpdate(false);
    setShowManualEntry(false);
    setSelectedLocation('');
    setQuantityAdjustment('');
    
    // Clear all refs
    isProcessingRef.current = false;
    isScanningActiveRef.current = false;
    detectionEnabledRef.current = false;
    lastDetectedRef.current = '';
    lastDetectionTimeRef.current = 0;
    
    // Clear detection delay timeout
    if (detectionDelayTimeoutRef.current) {
      clearTimeout(detectionDelayTimeoutRef.current);
      detectionDelayTimeoutRef.current = null;
    }
    
    // Clean up and null the code reader - a fresh one will be created when camera starts
    if (codeReaderRef.current) {
      try {
        // @ts-ignore - reset method exists but isn't in types
        codeReaderRef.current.reset();
      } catch (e) {
        // Ignore errors during reset
      }
      codeReaderRef.current = null;
    }
    
    // Keep currentCameraIndex and availableCameras to remember user's camera choice
  };

  const handleClose = () => {
    stopCamera();
    resetScanner();
    onClose();
  };

  const currentInventory = inventoryData?.filter(
    inv => inv.productId === productInfo?.id
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <Card>
            <CardContent className="p-4">
              <div className="relative bg-muted rounded-lg aspect-square flex items-center justify-center overflow-hidden">
                {isScanning ? (
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : isSearching ? (
                  <div className="text-center">
                    <Loader2 className="h-16 w-16 mx-auto mb-2 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Searching for product...</p>
                  </div>
                ) : scannedCode && productInfo ? (
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">Product Found!</p>
                    <Badge variant="secondary" className="mt-2" data-testid="badge-scanned-code">
                      {scannedCode}
                    </Badge>
                  </div>
                ) : scannedCode ? (
                  <div className="text-center">
                    <X className="h-16 w-16 mx-auto mb-2 text-destructive" />
                    <p className="text-sm font-medium">Product Not Found</p>
                    <Badge variant="secondary" className="mt-2">
                      {scannedCode}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center">
                    <Scan className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Ready to scan</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive" data-testid="text-error">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {gs1Data && (gs1Data.gtin || gs1Data.expirationDate || gs1Data.serialNumber || gs1Data.lotNumber) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Barcode Data (GS1)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {gs1Data.gtin && (
                  <div>
                    <span className="text-sm font-medium">Item Number (GTIN):</span>
                    <span className="ml-2 text-sm font-mono" data-testid="text-gs1-gtin">{gs1Data.gtin}</span>
                  </div>
                )}
                {gs1Data.expirationDate && (
                  <div>
                    <span className="text-sm font-medium">Expiration Date:</span>
                    <span className="ml-2 text-sm" data-testid="text-gs1-expiration">{gs1Data.expirationDate}</span>
                  </div>
                )}
                {gs1Data.serialNumber && (
                  <div>
                    <span className="text-sm font-medium">Serial Number:</span>
                    <span className="ml-2 text-sm font-mono" data-testid="text-gs1-serial">{gs1Data.serialNumber}</span>
                  </div>
                )}
                {gs1Data.lotNumber && (
                  <div>
                    <span className="text-sm font-medium">Lot Number:</span>
                    <span className="ml-2 text-sm font-mono" data-testid="text-gs1-lot">{gs1Data.lotNumber}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Raw: </span>
                  <span className="text-xs font-mono text-muted-foreground">{formatGS1Display(gs1Data)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {productInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Name:</span>
                  <span className="ml-2 text-sm" data-testid="text-product-name">{productInfo.name}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Model:</span>
                  <span className="ml-2 text-sm" data-testid="text-product-model">{productInfo.modelNumber}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">GTIN:</span>
                  <span className="ml-2 text-sm font-mono" data-testid="text-product-gtin">{productInfo.gtin}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {productInfo && currentInventory && currentInventory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentInventory.map(inv => {
                  const isLowStock = inv.location === 'car' 
                    ? inv.quantity < inv.product.minCarStock
                    : inv.quantity < inv.product.minTotalStock;
                  return (
                    <div key={inv.id} className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{inv.location}:</span>
                      <Badge variant={isLowStock ? "destructive" : "secondary"}>
                        {inv.quantity} units
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Removed "Update Inventory" UI - inventory should be managed through AddInventoryDialog */}

          {false && productInfo && showInventoryUpdate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger id="location" data-testid="select-location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity Adjustment</Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="Enter +/- amount (e.g., +5 or -3)"
                    value={quantityAdjustment}
                    onChange={(e) => setQuantityAdjustment(e.target.value)}
                    data-testid="input-quantity-adjustment"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowInventoryUpdate(false)}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-cancel-inventory"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInventoryUpdate}
                    disabled={!selectedLocation || !quantityAdjustment || updateInventoryMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-inventory"
                  >
                    {updateInventoryMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showManualEntry ? (
            <Button
              onClick={() => setShowManualEntry(true)}
              variant="outline"
              className="w-full"
              data-testid="button-show-manual-entry"
            >
              Enter Code Manually
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manual Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter barcode, model, or serial number"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
                    autoComplete="off"
                    autoFocus
                    data-testid="input-manual-barcode"
                  />
                  <Button 
                    onClick={handleManualEntry}
                    disabled={!manualCode.trim() || isSearching}
                    data-testid="button-manual-entry"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            {!isScanning && !scannedCode && (
              <Button 
                onClick={() => startCamera()} 
                className="flex-1"
                data-testid="button-start-camera"
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            )}
            
            {isScanning && (
              <>
                {availableCameras.length > 1 && (
                  <Button 
                    onClick={switchCamera} 
                    variant="outline"
                    size="icon"
                    data-testid="button-switch-camera"
                    title="Switch Camera"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  onClick={stopCamera} 
                  variant="outline" 
                  className="flex-1"
                  data-testid="button-stop-camera"
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop Scanning
                </Button>
              </>
            )}
            
            {scannedCode && (
              <>
                <Button 
                  onClick={resetScanner} 
                  variant="outline"
                  data-testid="button-scan-again"
                >
                  Scan Again
                </Button>
                <Button 
                  onClick={handleConfirm} 
                  className="flex-1"
                  data-testid="button-confirm-scan"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

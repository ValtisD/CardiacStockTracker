import { useState, useRef } from "react";
import { Camera, Scan, X, CheckCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (barcode: string, productInfo?: any) => void;
  title?: string;
}

interface ScannedProduct {
  barcode: string;
  name: string;
  modelNumber: string;
  category: string;
  manufacturer: string;
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
  const [productInfo, setProductInfo] = useState<ScannedProduct | null>(null);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Todo: remove mock functionality
  const mockProductDatabase: Record<string, ScannedProduct> = {
    '123456789012': {
      barcode: '123456789012',
      name: 'Medtronic Azure Pacemaker',
      modelNumber: 'XT1234',
      category: 'Device',
      manufacturer: 'Medtronic'
    },
    '987654321098': {
      barcode: '987654321098',
      name: 'Boston Scientific ICD Lead',
      modelNumber: 'BS5678',
      category: 'Lead/Electrode',
      manufacturer: 'Boston Scientific'
    },
    '456789012345': {
      barcode: '456789012345',
      name: 'Surgical Gloves Size M',
      modelNumber: 'SG001',
      category: 'Material',
      manufacturer: 'Medical Supplies Inc'
    }
  };

  const startCamera = async () => {
    setIsScanning(true);
    setError('');
    
    try {
      // Todo: remove mock functionality - replace with actual camera access
      console.log('Starting camera for barcode scanning...');
      
      // Simulate camera initialization delay
      setTimeout(() => {
        console.log('Camera initialized (simulated)');
      }, 1000);
      
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    // Todo: remove mock functionality - stop actual camera stream
    console.log('Camera stopped');
  };

  const simulateScan = () => {
    // Todo: remove mock functionality
    const mockBarcodes = Object.keys(mockProductDatabase);
    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
    
    setTimeout(() => {
      handleBarcodeDetected(randomBarcode);
    }, 2000);
  };

  const handleBarcodeDetected = (barcode: string) => {
    setScannedCode(barcode);
    setIsScanning(false);
    
    // Look up product information
    const product = mockProductDatabase[barcode];
    if (product) {
      setProductInfo(product);
    } else {
      setProductInfo({
        barcode,
        name: 'Unknown Product',
        modelNumber: 'N/A',
        category: 'Unknown',
        manufacturer: 'Unknown'
      });
    }
    
    console.log('Barcode detected:', barcode);
  };

  const handleManualEntry = () => {
    if (manualCode.trim()) {
      handleBarcodeDetected(manualCode.trim());
      setManualCode('');
    }
  };

  const handleConfirm = () => {
    if (scannedCode) {
      onScanComplete(scannedCode, productInfo);
      resetScanner();
      onClose();
    }
  };

  const resetScanner = () => {
    setScannedCode('');
    setProductInfo(null);
    setManualCode('');
    setError('');
    setIsScanning(false);
  };

  const handleClose = () => {
    stopCamera();
    resetScanner();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera View */}
          <Card>
            <CardContent className="p-4">
              <div className="relative bg-muted rounded-lg aspect-square flex items-center justify-center">
                {isScanning ? (
                  <div className="text-center">
                    <div className="animate-pulse">
                      <Camera className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Scanning...</p>
                      <div className="mt-4">
                        <div className="border-2 border-primary rounded-lg w-32 h-20 mx-auto animate-pulse"></div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="mt-4"
                      onClick={simulateScan}
                      data-testid="button-simulate-scan"
                    >
                      Simulate Scan
                    </Button>
                  </div>
                ) : scannedCode ? (
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">Barcode Scanned!</p>
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
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Information */}
          {productInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Product Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Name:</span>
                  <span className="ml-2 text-sm">{productInfo.name}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Model:</span>
                  <span className="ml-2 text-sm">{productInfo.modelNumber}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Category:</span>
                  <Badge variant="outline" className="ml-2">
                    {productInfo.category}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Manufacturer:</span>
                  <span className="ml-2 text-sm">{productInfo.manufacturer}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Entry */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manual Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter barcode manually"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
                  data-testid="input-manual-barcode"
                />
                <Button 
                  onClick={handleManualEntry}
                  disabled={!manualCode.trim()}
                  data-testid="button-manual-entry"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isScanning && !scannedCode && (
              <Button 
                onClick={startCamera} 
                className="flex-1"
                data-testid="button-start-camera"
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            )}
            
            {isScanning && (
              <Button 
                onClick={stopCamera} 
                variant="outline" 
                className="flex-1"
                data-testid="button-stop-camera"
              >
                <X className="h-4 w-4 mr-2" />
                Stop Scanning
              </Button>
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
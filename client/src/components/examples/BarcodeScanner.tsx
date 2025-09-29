import { useState } from "react";
import BarcodeScanner from '../BarcodeScanner';
import { Button } from "@/components/ui/button";

export default function BarcodeScannerExample() {
  const [isOpen, setIsOpen] = useState(false);

  const handleScanComplete = (barcode: string, productInfo?: any) => {
    console.log('Scan completed:', barcode, productInfo);
  };

  return (
    <div className="p-4 space-y-4">
      <Button onClick={() => setIsOpen(true)} data-testid="button-open-scanner">
        Open Barcode Scanner
      </Button>
      
      <BarcodeScanner
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onScanComplete={handleScanComplete}
        title="Scan Product Barcode"
      />
    </div>
  );
}
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Package, Calendar, Hash, Trash2, Loader2 } from "lucide-react";
import { StockCountBarcodeScanner } from "@/components/StockCountBarcodeScanner";
import { parseGS1Barcode } from "@/lib/gs1Parser";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";

interface StockCountScannerProps {
  sessionId: string;
  scannedLocation: "home" | "car";
}

export function StockCountScanner({ sessionId, scannedLocation }: StockCountScannerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Fetch scanned items
  const { data: scannedItems = [] } = useQuery<any[]>({
    queryKey: ["/api/stock-count/sessions", sessionId, "items"],
    refetchInterval: 2000,
  });

  // Auto-focus scanner input on mount
  useEffect(() => {
    scannerInputRef.current?.focus();
  }, []);

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (itemData: any) => {
      return await apiRequest("POST", `/api/stock-count/sessions/${sessionId}/items`, itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/stock-count/sessions", sessionId, "items"],
      });
      setScannerInput("");
      setIsProcessing(false);
      // Re-focus input for next scan
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast({
        variant: "destructive",
        description: error.message || t("stockCount.errors.addItemFailed"),
      });
      // Re-focus input even on error
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest("DELETE", `/api/stock-count/sessions/${sessionId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/stock-count/sessions", sessionId, "items"],
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || t("common.deleteFailed"),
      });
    },
  });

  const handleBarcodeScan = async (barcodeData: string) => {
    console.log('📦 Stock Count - Raw barcode data:', barcodeData);
    
    // Parse GS1 data
    const parsedGs1Data = parseGS1Barcode(barcodeData);
    console.log('📦 Stock Count - Parsed GS1 data:', parsedGs1Data);
    
    if (!parsedGs1Data.gtin) {
      throw new Error(t("stockCount.errors.noGtin"));
    }

    console.log('📦 Stock Count - Looking up product with GTIN:', parsedGs1Data.gtin);

    // Fetch product by GTIN
    const response = await apiRequest("GET", `/api/products?gtin=${parsedGs1Data.gtin}`);
    const products = await response.json();
    console.log('📦 Stock Count - Products found:', products);
    const product = products?.[0];

    if (!product) {
      throw new Error(t("stockCount.errors.productNotFound"));
    }

    console.log('📦 Stock Count - Selected product:', product);

    // Determine tracking mode
    const trackingMode = parsedGs1Data.serialNumber ? "serial" : parsedGs1Data.lotNumber ? "lot" : null;

    // Use quantity from barcode if present (box barcode), otherwise default to 1
    const quantity = parsedGs1Data.quantity || 1;

    // Log box barcode detection
    if (parsedGs1Data.quantity && parsedGs1Data.quantity > 1) {
      console.log(`📦 Box barcode detected - adding ${quantity} items`);
      toast({
        description: `${t("stockCount.messages.boxBarcodeDetected")}: ${quantity} ${t("stockCount.labels.items")}`,
      });
    }

    // Add item to count
    await addItemMutation.mutateAsync({
      productId: product.id,
      scannedLocation,
      trackingMode,
      serialNumber: parsedGs1Data.serialNumber || null,
      lotNumber: parsedGs1Data.lotNumber || null,
      expirationDate: parsedGs1Data.expirationDate || null,
      quantity,
    });
  };

  const handleScannerInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerInput.trim() && !isProcessing) {
      e.preventDefault();
      setIsProcessing(true);
      
      try {
        await handleBarcodeScan(scannerInput.trim());
      } catch (error: any) {
        toast({
          variant: "destructive",
          description: error.message || t("stockCount.errors.scanFailed"),
        });
        setIsProcessing(false);
        setScannerInput("");
      }
    }
  };

  // Group scanned items by product
  const groupedItems = scannedItems.reduce((acc: any, item: any) => {
    const key = item.product.id;
    if (!acc[key]) {
      acc[key] = {
        product: item.product,
        items: [],
        totalQuantity: 0,
      };
    }
    acc[key].items.push(item);
    acc[key].totalQuantity += item.quantity;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Scanner Input Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="relative">
                  <Input
                    ref={scannerInputRef}
                    type="text"
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    onKeyDown={handleScannerInput}
                    placeholder="Scan barcode or enter GTIN..."
                    className="font-mono text-lg pr-10"
                    data-testid="input-scanner"
                    autoFocus
                    disabled={isProcessing}
                  />
                  {isProcessing && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Focus here and scan with your Bluetooth scanner, or press Enter after typing
                </p>
              </div>
              <Button
                onClick={() => setShowCameraScanner(true)}
                variant="outline"
                size="icon"
                className="shrink-0 h-[52px] w-[52px]"
                data-testid="button-camera-scan"
              >
                <Camera className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <StockCountBarcodeScanner
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleBarcodeScan}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold" data-testid="text-scanned-items-title">
          {t("stockCount.labels.scannedItems")} ({scannedItems.length})
        </h2>

        {Object.values(groupedItems).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-50" />
              <p>{t("stockCount.messages.noItemsScanned")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {Object.values(groupedItems).map((group: any) => (
              <Card key={group.product.id} data-testid={`card-scanned-product-${group.product.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{group.product.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {group.product.modelNumber}
                      </p>
                    </div>
                    <Badge variant="secondary" data-testid={`badge-quantity-${group.product.id}`}>
                      {t("stockCount.labels.qty")}: {group.totalQuantity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 text-sm p-2 rounded-md bg-muted/50"
                        data-testid={`item-scanned-${item.id}`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {item.serialNumber && (
                            <div className="flex items-center gap-1">
                              <Hash className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{item.serialNumber}</span>
                            </div>
                          )}
                          {item.lotNumber && (
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{item.lotNumber}</span>
                              {item.quantity > 1 && (
                                <Badge variant="outline" className="ml-2">x{item.quantity}</Badge>
                              )}
                            </div>
                          )}
                          {item.expirationDate && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(item.expirationDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          <Badge variant="outline">
                            {item.scannedLocation === "car" ? t("stockCount.locations.car") : t("stockCount.locations.home")}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          disabled={deleteItemMutation.isPending}
                          className="h-8 w-8 shrink-0"
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

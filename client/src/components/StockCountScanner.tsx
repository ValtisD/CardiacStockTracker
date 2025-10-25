import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Scan, Package, Calendar, Hash } from "lucide-react";
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
  const [showScanner, setShowScanner] = useState(false);
  const [manualGtin, setManualGtin] = useState("");

  // Fetch scanned items
  const { data: scannedItems = [] } = useQuery<any[]>({
    queryKey: ["/api/stock-count/sessions", sessionId, "items"],
    refetchInterval: 2000,
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (itemData: any) => {
      return await apiRequest("POST", `/api/stock-count/sessions/${sessionId}/items`, itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/stock-count/sessions", sessionId, "items"],
      });
      setShowScanner(false);
      setManualGtin("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.message || t("stockCount.errors.addItemFailed"),
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

    // Add item to count
    await addItemMutation.mutateAsync({
      productId: product.id,
      scannedLocation,
      trackingMode,
      serialNumber: parsedGs1Data.serialNumber || null,
      lotNumber: parsedGs1Data.lotNumber || null,
      expirationDate: parsedGs1Data.expirationDate || null,
      quantity: 1,
    });
  };

  const handleManualGtinSubmit = async () => {
    if (!manualGtin.trim()) return;
    
    try {
      // Fetch product by GTIN
      const response = await apiRequest("GET", `/api/products?gtin=${manualGtin.trim()}`);
      const products = await response.json();
      const product = products?.[0];

      if (!product) {
        toast({
          variant: "destructive",
          description: t("stockCount.errors.productNotFound"),
        });
        return;
      }

      // Add item without serial/lot (manual entry)
      await addItemMutation.mutateAsync({
        productId: product.id,
        scannedLocation,
        trackingMode: null,
        serialNumber: null,
        lotNumber: null,
        expirationDate: null,
        quantity: 1,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        description: error.message || t("stockCount.errors.addItemFailed"),
      });
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
      <div className="flex gap-4">
        <Button
          onClick={() => setShowScanner(true)}
          className="flex-1"
          data-testid="button-scan-barcode"
        >
          <Scan className="mr-2 h-4 w-4" />
          {t("stockCount.actions.scanBarcode")}
        </Button>
        <div className="flex gap-2 flex-1">
          <Input
            placeholder={t("stockCount.labels.enterGtin")}
            value={manualGtin}
            onChange={(e) => setManualGtin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualGtinSubmit()}
            data-testid="input-manual-gtin"
          />
          <Button
            onClick={handleManualGtinSubmit}
            disabled={!manualGtin.trim() || addItemMutation.isPending}
            data-testid="button-add-manual"
          >
            {t("stockCount.actions.add")}
          </Button>
        </div>
      </div>

      <StockCountBarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
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
                        <Badge variant="outline" className="ml-auto">
                          {item.scannedLocation === "car" ? t("stockCount.locations.car") : t("stockCount.locations.home")}
                        </Badge>
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

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Scan, Trash2, Plus, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseGS1Barcode } from "@/lib/gs1Parser";
import type { Product } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface ScannedItem {
  id: string;
  productId: string;
  productName: string;
  productModel: string;
  gtin: string;
  trackingMode: 'serial' | 'lot' | null;
  serialNumber: string | null;
  lotNumber: string | null;
  expirationDate: string | null;
  quantity: number;
}

interface BatchScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BatchScanDialog({ open, onOpenChange }: BatchScanDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [manualBarcode, setManualBarcode] = useState('');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const batchAddMutation = useMutation({
    mutationFn: async (items: ScannedItem[]) => {
      const promises = items.map(item => 
        apiRequest('POST', '/api/inventory', {
          productId: item.productId,
          location: 'home',
          trackingMode: item.trackingMode,
          serialNumber: item.serialNumber,
          lotNumber: item.lotNumber,
          quantity: item.quantity,
          expirationDate: item.expirationDate,
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false
      });
      setScannedItems([]);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t('inventory.addFailed'),
        description: error.message || t('inventory.addFailedDescription'),
        variant: "destructive",
      });
    },
  });

  const handleScanBarcode = async () => {
    if (!manualBarcode.trim()) return;

    setIsLoadingProduct(true);
    try {
      // Parse GS1 barcode first to extract GTIN and other data
      const gs1Data = parseGS1Barcode(manualBarcode.trim());
      
      // Use GTIN from parsed data if available, otherwise use the full barcode
      const searchQuery = gs1Data.gtin || manualBarcode.trim();
      
      const response = await apiRequest('GET', `/api/products/multi-search/${encodeURIComponent(searchQuery)}`);
      const foundProducts: Product[] = await response.json();

      if (foundProducts.length === 0) {
        toast({
          title: t('inventory.productNotFound'),
          description: t('inventory.noProductsMatchBarcode'),
          variant: "destructive",
        });
        setManualBarcode('');
        setIsLoadingProduct(false);
        return;
      }

      const product = foundProducts[0];
      
      // Normalize GS1 data fields to null if undefined (for consistent comparison)
      const scannedSerial = gs1Data.serialNumber ?? null;
      const scannedLot = gs1Data.lotNumber ?? null;
      const scannedExpiration = gs1Data.expirationDate ?? null;
      
      const trackingMode = scannedSerial ? 'serial' : (scannedLot ? 'lot' : null);

      // Check if item already in list
      // For serial-tracked items: duplicate serial is an error (serials are unique)
      // For lot-tracked or no tracking: increment quantity instead
      if (trackingMode === 'serial' && scannedSerial) {
        const existingSerialItem = scannedItems.find(item => 
          item.productId === product.id && 
          item.serialNumber === scannedSerial
        );
        
        if (existingSerialItem) {
          toast({
            title: t('batchScan.itemAlreadyScanned'),
            description: t('batchScan.serialAlreadyInList'),
            variant: "destructive",
          });
          setManualBarcode('');
          setIsLoadingProduct(false);
          return;
        }
      }

      // For lot-tracked or non-tracked items, check if we can increment existing item
      if (trackingMode !== 'serial') {
        const existingLotItem = scannedItems.find(item => 
          item.productId === product.id && 
          item.lotNumber === scannedLot &&
          item.expirationDate === scannedExpiration
        );
        
        if (existingLotItem) {
          // Increment quantity for existing lot/non-tracked item
          setScannedItems(scannedItems.map(item => 
            item.id === existingLotItem.id 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ));
          setManualBarcode('');
          setIsLoadingProduct(false);
          return;
        }
      }
      
      // Add new item
      const newItem: ScannedItem = {
        id: `${Date.now()}-${Math.random()}`,
        productId: product.id,
        productName: product.name,
        productModel: product.modelNumber,
        gtin: product.gtin,
        trackingMode,
        serialNumber: scannedSerial,
        lotNumber: scannedLot,
        expirationDate: scannedExpiration,
        quantity: 1,
      };

      setScannedItems([...scannedItems, newItem]);
      setManualBarcode('');
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('batchScan.scanFailed'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setScannedItems(scannedItems.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    setScannedItems(scannedItems.map(item => 
      item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  };

  const handleSubmit = () => {
    if (scannedItems.length === 0) return;
    batchAddMutation.mutate(scannedItems);
  };

  const handleCancel = () => {
    setScannedItems([]);
    setManualBarcode('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            {t('batchScan.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barcode Input */}
          <div className="space-y-2">
            <Label htmlFor="batch-barcode">{t('batchScan.scanBarcode')}</Label>
            <div className="flex gap-2">
              <Input
                id="batch-barcode"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleScanBarcode();
                  }
                }}
                placeholder={t('batchScan.enterBarcodePlaceholder')}
                disabled={isLoadingProduct || batchAddMutation.isPending}
                data-testid="input-batch-barcode"
              />
              <Button
                onClick={handleScanBarcode}
                disabled={!manualBarcode.trim() || isLoadingProduct || batchAddMutation.isPending}
                data-testid="button-add-scan"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('batchScan.addScan')}
              </Button>
            </div>
          </div>

          {/* Scanned Items List */}
          <div className="space-y-2">
            <Label>{t('batchScan.scannedItems')} ({scannedItems.length})</Label>
            
            {scannedItems.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>{t('batchScan.noItemsScanned')}</p>
                    <p className="text-sm mt-1">{t('batchScan.scanBarcodeToStart')}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {scannedItems.map((item) => (
                  <Card key={item.id} data-testid={`card-scanned-item-${item.id}`}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('dashboard.tableModel')}: {item.productModel}
                          </div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {item.trackingMode === 'serial' && item.serialNumber && (
                              <Badge variant="outline" className="text-xs">
                                {t('inventory.serial')}: {item.serialNumber}
                              </Badge>
                            )}
                            {item.trackingMode === 'lot' && item.lotNumber && (
                              <Badge variant="outline" className="text-xs">
                                {t('inventory.lot')}: {item.lotNumber}
                              </Badge>
                            )}
                            {item.expirationDate && (
                              <Badge variant="secondary" className="text-xs">
                                {t('inventory.exp')}: {new Date(item.expirationDate).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`qty-${item.id}`} className="text-sm">
                              {t('inventory.qty')}:
                            </Label>
                            <Input
                              id={`qty-${item.id}`}
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-16 h-8"
                              disabled={batchAddMutation.isPending}
                              data-testid={`input-quantity-${item.id}`}
                            />
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={batchAddMutation.isPending}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={batchAddMutation.isPending}
              data-testid="button-cancel-batch"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={scannedItems.length === 0 || batchAddMutation.isPending}
              data-testid="button-submit-batch"
            >
              {batchAddMutation.isPending ? t('common.adding') : t('batchScan.addAllToHome')} ({scannedItems.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { format } from "date-fns";

interface InventoryItem {
  id: string;
  serialNumber: string | null;
  lotNumber: string | null;
  location: string;
  quantity: number;
  expirationDate: string | null;
}

interface StockOverviewItem {
  gtin: string;
  modelNumber: string;
  productName: string;
  homeQty: number;
  carQty: number;
  totalQty: number;
  items: InventoryItem[];
}

export default function StockOverview() {
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState<StockOverviewItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const { data: stockData, isLoading } = useQuery<StockOverviewItem[]>({
    queryKey: ['/api/inventory/overview'],
    refetchOnWindowFocus: true,
  });

  const handleViewDetails = (item: StockOverviewItem) => {
    setSelectedProduct(item);
    setShowDetailsDialog(true);
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-stock-overview-title">{t('stockOverview.title')}</CardTitle>
          <CardDescription>{t('stockOverview.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">
              {t('stockOverview.loading')}
            </div>
          ) : !stockData || stockData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-stock">
              {t('stockOverview.noStock')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-model-number">{t('stockOverview.modelNumber')}</TableHead>
                    <TableHead data-testid="header-product-name">{t('stockOverview.productName')}</TableHead>
                    <TableHead className="text-right" data-testid="header-home-qty">{t('stockOverview.homeQty')}</TableHead>
                    <TableHead className="text-right" data-testid="header-car-qty">{t('stockOverview.carQty')}</TableHead>
                    <TableHead className="text-right" data-testid="header-total-qty">{t('stockOverview.totalQty')}</TableHead>
                    <TableHead className="text-right" data-testid="header-actions">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockData.map((item) => (
                    <TableRow key={item.gtin} data-testid={`row-product-${item.gtin}`}>
                      <TableCell className="font-medium" data-testid={`text-model-${item.gtin}`}>
                        {item.modelNumber}
                      </TableCell>
                      <TableCell data-testid={`text-product-name-${item.gtin}`}>
                        {item.productName}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-home-qty-${item.gtin}`}>
                        {item.homeQty}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-car-qty-${item.gtin}`}>
                        {item.carQty}
                      </TableCell>
                      <TableCell className="text-right font-bold" data-testid={`text-total-qty-${item.gtin}`}>
                        {item.totalQty}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDetails(item)}
                          data-testid={`button-view-details-${item.gtin}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t('stockOverview.viewDetails')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-item-details-title">
              {t('stockOverview.itemDetails')}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct && (
                <div className="space-y-1 text-left">
                  <div>{selectedProduct.productName}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('stockOverview.modelNumber')}: {selectedProduct.modelNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedProduct.items.length} {t('stockOverview.items')}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-detail-serial">{t('stockOverview.serialNumber')}</TableHead>
                    <TableHead data-testid="header-detail-lot">{t('stockOverview.lotNumber')}</TableHead>
                    <TableHead data-testid="header-detail-location">{t('stockOverview.location')}</TableHead>
                    <TableHead className="text-right" data-testid="header-detail-quantity">{t('stockOverview.quantity')}</TableHead>
                    <TableHead data-testid="header-detail-expiration">{t('stockOverview.expiration')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProduct.items.map((item, index) => (
                    <TableRow key={item.id} data-testid={`row-detail-${index}`}>
                      <TableCell data-testid={`text-detail-serial-${index}`}>
                        {item.serialNumber || '-'}
                      </TableCell>
                      <TableCell data-testid={`text-detail-lot-${index}`}>
                        {item.lotNumber || '-'}
                      </TableCell>
                      <TableCell data-testid={`text-detail-location-${index}`}>
                        {item.location === 'home' ? t('stockOverview.home') : t('stockOverview.car')}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-detail-quantity-${index}`}>
                        {item.quantity}
                      </TableCell>
                      <TableCell data-testid={`text-detail-expiration-${index}`}>
                        {item.expirationDate 
                          ? format(new Date(item.expirationDate), 'yyyy-MM-dd')
                          : t('stockOverview.noExpiration')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

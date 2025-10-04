import { Package, Car, Hospital, AlertTriangle, TrendingUp, Calendar, Plus, Building2, Download, FileText, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import type { Inventory, ImplantProcedure, Product, Hospital as HospitalType } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';

interface InventoryWithProduct extends Inventory {
  product?: Product;
}

interface ImplantProcedureWithHospital extends ImplantProcedure {
  hospital: HospitalType;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [showProceduresDialog, setShowProceduresDialog] = useState(false);
  const [showExpiringReport, setShowExpiringReport] = useState(false);
  const { toast } = useToast();
  const { data: homeInventory, isLoading: homeLoading, error: homeError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory?location=home"],
  });

  const { data: carInventory, isLoading: carLoading, error: carError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory?location=car"],
  });

  const { data: homeLowStock, isLoading: homeLowStockLoading, error: homeLowStockError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory/low-stock?location=home"],
  });

  const { data: carLowStock, isLoading: carLowStockLoading, error: carLowStockError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory/low-stock?location=car"],
  });

  const { data: procedures, isLoading: proceduresLoading, error: proceduresError } = useQuery<ImplantProcedureWithHospital[]>({
    queryKey: ["/api/implant-procedures"],
  });

  // Get recent procedures (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentProcedures = procedures?.filter(proc => {
    const procDate = new Date(proc.implantDate);
    return procDate >= thirtyDaysAgo;
  }).sort((a, b) => new Date(b.implantDate).getTime() - new Date(a.implantDate).getTime()) || [];

  // Get expiring products (next 90 days)
  // NOTE: Now reads from inventory.expirationDate instead of products.expirationDate
  // This allows per-item tracking of expiration dates for serial/lot tracked items
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const allInventory = [...(homeInventory || []), ...(carInventory || [])];
  const expiringItems = allInventory.filter(item => {
    if (!item.expirationDate) return false;
    const expDate = new Date(item.expirationDate);
    const today = new Date();
    return expDate >= today && expDate <= ninetyDaysFromNow;
  }).sort((a, b) => {
    const dateA = new Date(a.expirationDate!);
    const dateB = new Date(b.expirationDate!);
    return dateA.getTime() - dateB.getTime();
  });

  const isLoading = homeLoading || carLoading || homeLowStockLoading || carLowStockLoading || proceduresLoading;
  const hasError = homeError || carError || homeLowStockError || carLowStockError || proceduresError;

  const homeStockTotal = homeInventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const carStockTotal = carInventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const homeLowStockCount = homeLowStock?.length || 0;
  const carLowStockCount = carLowStock?.length || 0;
  const recentProceduresCount = recentProcedures.length;
  const expiringItemsCount = expiringItems.length;

  if (hasError) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t('dashboard.title')}</h2>
        </div>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('dashboard.errorLoadingDashboard')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.unableToLoadData')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('dashboard.title')}</h2>
        <Badge variant="secondary" data-testid="text-last-updated">
          {t('dashboard.lastUpdated')} {new Date().toLocaleDateString()}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/inventory/home")} data-testid="card-home-stock">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.homeStock')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-home-stock-total">
                ...
              </div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-home-stock-total">
                {homeStockTotal}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isLoading ? (
                <span>{t('common.loading')}</span>
              ) : homeLowStockCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {homeLowStockCount} {t('dashboard.lowStock').toLowerCase()}
                </Badge>
              ) : (
                <span className="text-green-600">{t('dashboard.allItemsInStock')}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/inventory/car")} data-testid="card-car-stock">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.carStock')}</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-car-stock-total">
                ...
              </div>
            ) : (
              <div className="text-2xl font-bold" data-testid="text-car-stock-total">
                {carStockTotal}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isLoading ? (
                <span>{t('common.loading')}</span>
              ) : carLowStockCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {carLowStockCount} {t('dashboard.lowStock').toLowerCase()}
                </Badge>
              ) : (
                <span className="text-green-600">{t('dashboard.allItemsReady')}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showProceduresDialog} onOpenChange={setShowProceduresDialog}>
          <DialogTrigger asChild>
            <Card className="hover-elevate cursor-pointer" data-testid="card-recent-procedures">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.recentProcedures')}</CardTitle>
                <Hospital className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-2xl font-bold text-muted-foreground" data-testid="text-recent-procedures">
                    ...
                  </div>
                ) : (
                  <div className="text-2xl font-bold" data-testid="text-recent-procedures">
                    {recentProceduresCount}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.last30Days')}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('dashboard.recentProceduresDialog')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {recentProcedures.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('dashboard.noProceduresLast30Days')}</p>
              ) : (
                recentProcedures.map((procedure) => (
                  <Card key={procedure.id} data-testid={`card-procedure-${procedure.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{procedure.hospital.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(procedure.implantDate), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <Badge variant="outline">{procedure.procedureType}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {procedure.notes && (
                        <div className="text-sm">
                          <span className="font-medium">{t('procedures.notes')}:</span> {procedure.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showExpiringReport} onOpenChange={setShowExpiringReport}>
          <DialogTrigger asChild>
            <Card className="hover-elevate cursor-pointer" data-testid="card-expiring-soon">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.expiringSoon')}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-2xl font-bold text-muted-foreground" data-testid="text-expiring-items">
                    ...
                  </div>
                ) : (
                  <div className="text-2xl font-bold" data-testid="text-expiring-items">
                    {expiringItemsCount}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.next90Days')}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                {t('dashboard.expiringReportTitle')}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const doc = new jsPDF();
                    
                    doc.setFontSize(18);
                    doc.text(t('dashboard.expiringReportTitle'), 14, 20);
                    doc.setFontSize(11);
                    doc.text(`${t('dashboard.generated')} ${format(new Date(), "MMM dd, yyyy")}`, 14, 28);
                    doc.text(t('dashboard.productsExpiringNext90Days'), 14, 34);
                    
                    const tableData = expiringItems.map(item => {
                      const daysUntil = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      return [
                        item.product?.name || '',
                        item.product?.modelNumber || '',
                        item.product?.gtin || '-',
                        item.location,
                        item.quantity.toString(),
                        format(new Date(item.expirationDate!), "MMM dd, yyyy"),
                        daysUntil.toString()
                      ];
                    });
                    
                    autoTable(doc, {
                      startY: 40,
                      head: [[t('dashboard.tableProduct'), t('dashboard.tableModel'), t('dashboard.tableGtin'), t('dashboard.tableLocation'), t('dashboard.tableQty'), t('dashboard.tableExpiration'), t('dashboard.tableDays')]],
                      body: tableData,
                      theme: 'striped',
                      headStyles: { fillColor: [59, 130, 246] },
                      styles: { fontSize: 9 },
                      columnStyles: {
                        0: { cellWidth: 45 },
                        1: { cellWidth: 30 },
                        2: { cellWidth: 30 },
                        3: { cellWidth: 20 },
                        4: { cellWidth: 15 },
                        5: { cellWidth: 30 },
                        6: { cellWidth: 15 }
                      }
                    });
                    
                    doc.save(`expiring-products-${format(new Date(), "yyyy-MM-dd")}.pdf`);
                  }}
                  data-testid="button-export-expiring"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('dashboard.exportPdf')}
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {expiringItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t('dashboard.noExpiringItems')}</p>
              ) : (
                expiringItems.map((item) => {
                  const daysUntil = Math.ceil((new Date(item.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <Card key={`${item.id}-${item.location}`} data-testid={`card-expiring-${item.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-base">{item.product?.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {t('dashboard.model')} {item.product?.modelNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={daysUntil < 30 ? "destructive" : "secondary"}>
                              {daysUntil} {t('dashboard.days')}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{item.location}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <div>
                          <span className="font-medium">{t('dashboard.expires')}</span> {format(new Date(item.expirationDate!), "MMM dd, yyyy")}
                        </div>
                        <div>
                          <span className="font-medium">{t('inventory.quantity')}:</span> {item.quantity}
                        </div>
                        {item.serialNumber && (
                          <div>
                            <span className="font-medium">{t('inventory.serial')}:</span> {item.serialNumber}
                          </div>
                        )}
                        {item.lotNumber && (
                          <div>
                            <span className="font-medium">{t('inventory.lot')}:</span> {item.lotNumber}
                          </div>
                        )}
                        {item.product?.gtin && (
                          <div>
                            <span className="font-medium">{t('products.gtin')}:</span> {item.product.gtin}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('dashboard.quickActions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/reports">
            <Button className="justify-start gap-2 w-full" data-testid="button-new-implant-report">
              <Calendar className="h-4 w-4" />
              {t('dashboard.newImplantReport')}
            </Button>
          </Link>
          <Link href="/products">
            <Button variant="outline" className="justify-start gap-2 w-full" data-testid="button-add-product">
              <Plus className="h-4 w-4" />
              {t('dashboard.addNewProduct')}
            </Button>
          </Link>
          <Link href="/hospitals">
            <Button variant="outline" className="justify-start gap-2 w-full" data-testid="button-add-hospital">
              <Building2 className="h-4 w-4" />
              {t('dashboard.addNewHospital')}
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="justify-start gap-2 w-full" 
            data-testid="button-car-stock-report"
            onClick={() => {
              if (!carLowStock || carLowStock.length === 0) {
                return;
              }
              
              const doc = new jsPDF();
              
              doc.setFontSize(18);
              doc.text(t('dashboard.carStockTransferReportTitle'), 14, 20);
              doc.setFontSize(11);
              doc.text(`${t('dashboard.generated')} ${format(new Date(), "MMM dd, yyyy")}`, 14, 28);
              doc.text(t('dashboard.itemsToTransfer'), 14, 34);
              
              const tableData = carLowStock.map(item => {
                const minCarStock = (item as any).userSettings?.minCarStock || 0;
                const reorderQty = Math.max(0, minCarStock - item.quantity);
                return [
                  item.product?.name || '',
                  item.product?.modelNumber || '',
                  item.product?.gtin || '-',
                  item.quantity.toString(),
                  minCarStock.toString(),
                  reorderQty.toString()
                ];
              });
              
              autoTable(doc, {
                startY: 40,
                head: [[t('dashboard.tableProduct'), t('dashboard.tableModel'), t('dashboard.tableGtin'), t('dashboard.tableCur'), t('dashboard.tableMin'), t('dashboard.tableXfer')]],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] },
                styles: { fontSize: 8 },
                columnStyles: {
                  0: { cellWidth: 'auto' },
                  1: { cellWidth: 'auto' },
                  2: { cellWidth: 'auto' },
                  3: { cellWidth: 'auto' },
                  4: { cellWidth: 'auto' },
                  5: { cellWidth: 'auto' }
                }
              });
              
              doc.save(`car-stock-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
            }}
            disabled={!carLowStock || carLowStock.length === 0}
          >
            <Car className="h-4 w-4" />
            {t('dashboard.carStockReport')}
          </Button>
          <Button 
            variant="outline" 
            className="justify-start gap-2 w-full" 
            data-testid="button-home-stock-report"
            onClick={() => {
              if (!homeLowStock || homeLowStock.length === 0) {
                return;
              }
              
              // Generate PDF
              const doc = new jsPDF();
              
              doc.setFontSize(18);
              doc.text(t('dashboard.homeStockReorderReportTitle'), 14, 20);
              doc.setFontSize(11);
              doc.text(`${t('dashboard.generated')} ${format(new Date(), "MMM dd, yyyy")}`, 14, 28);
              doc.text(t('dashboard.itemsToReorder'), 14, 34);
              
              const tableData = homeLowStock.map(item => {
                const minTotalStock = (item as any).userSettings?.minTotalStock || 0;
                const reorderQty = Math.max(0, minTotalStock - item.quantity);
                return [
                  item.product?.name || '',
                  item.product?.modelNumber || '',
                  item.product?.gtin || '-',
                  item.quantity.toString(),
                  minTotalStock.toString(),
                  reorderQty.toString()
                ];
              });
              
              autoTable(doc, {
                startY: 40,
                head: [[t('dashboard.tableProduct'), t('dashboard.tableModel'), t('dashboard.tableGtin'), t('dashboard.tableCur'), t('dashboard.tableMin'), t('dashboard.tableReord')]],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [239, 68, 68] },
                styles: { fontSize: 8 },
                columnStyles: {
                  0: { cellWidth: 'auto' },
                  1: { cellWidth: 'auto' },
                  2: { cellWidth: 'auto' },
                  3: { cellWidth: 'auto' },
                  4: { cellWidth: 'auto' },
                  5: { cellWidth: 'auto' }
                }
              });
              
              doc.save(`home-stock-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
              
              // Generate email text in German
              const itemsList = homeLowStock.map(item => {
                const minTotalStock = (item as any).userSettings?.minTotalStock || 0;
                const reorderQty = Math.max(0, minTotalStock - item.quantity);
                return `${item.product?.modelNumber || 'N/A'} - ${reorderQty} ${t('dashboard.emailPieces')}`;
              }).join('\n');
              
              const emailText = `${t('dashboard.emailGreeting')}

${t('dashboard.emailPleaseReorder')}

${itemsList}

${t('dashboard.emailClosing')}`;
              
              // Copy to clipboard
              navigator.clipboard.writeText(emailText).then(() => {
                toast({
                  title: t('dashboard.emailTextCopied'),
                  description: t('dashboard.reorderTextCopied'),
                });
              }).catch((err) => {
                toast({
                  title: t('dashboard.failedToCopy'),
                  description: t('dashboard.couldNotCopy'),
                  variant: "destructive"
                });
              });
            }}
            disabled={!homeLowStock || homeLowStock.length === 0}
          >
            <Mail className="h-4 w-4" />
            {t('dashboard.homeStockReport')}
          </Button>
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      {!isLoading && (homeLowStockCount > 0 || carLowStockCount > 0) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('dashboard.lowStockAlerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {homeLowStockCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">{t('dashboard.homeInventoryLowCount', { count: homeLowStockCount })}</span>
                  <Link href="/inventory/home">
                    <Button size="sm" variant="destructive" data-testid="button-view-home-alerts">
                      {t('dashboard.viewItems')}
                    </Button>
                  </Link>
                </div>
              )}
              {carLowStockCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">{t('dashboard.carInventoryLowCount', { count: carLowStockCount })}</span>
                  <Link href="/inventory/car">
                    <Button size="sm" variant="destructive" data-testid="button-view-car-alerts">
                      {t('dashboard.restockNow')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { Package, Car, Hospital, AlertTriangle, TrendingUp, Calendar, Plus, Building2, Download, FileText } from "lucide-react";
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

interface InventoryWithProduct extends Inventory {
  product?: Product;
}

interface ImplantProcedureWithHospital extends ImplantProcedure {
  hospital: HospitalType;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [showProceduresDialog, setShowProceduresDialog] = useState(false);
  const [showExpiringReport, setShowExpiringReport] = useState(false);
  const { data: homeInventory, isLoading: homeLoading, error: homeError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory", "home"],
    queryFn: async () => {
      const response = await fetch('/api/inventory?location=home');
      if (!response.ok) throw new Error('Failed to fetch home inventory');
      return response.json();
    },
  });

  const { data: carInventory, isLoading: carLoading, error: carError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory", "car"],
    queryFn: async () => {
      const response = await fetch('/api/inventory?location=car');
      if (!response.ok) throw new Error('Failed to fetch car inventory');
      return response.json();
    },
  });

  const { data: homeLowStock, isLoading: homeLowStockLoading, error: homeLowStockError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory/low-stock", "home"],
    queryFn: async () => {
      const response = await fetch('/api/inventory/low-stock?location=home');
      if (!response.ok) throw new Error('Failed to fetch home low stock');
      return response.json();
    },
  });

  const { data: carLowStock, isLoading: carLowStockLoading, error: carLowStockError } = useQuery<InventoryWithProduct[]>({
    queryKey: ["/api/inventory/low-stock", "car"],
    queryFn: async () => {
      const response = await fetch('/api/inventory/low-stock?location=car');
      if (!response.ok) throw new Error('Failed to fetch car low stock');
      return response.json();
    },
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
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const allInventory = [...(homeInventory || []), ...(carInventory || [])];
  const expiringItems = allInventory.filter(item => {
    if (!item.product?.expirationDate) return false;
    const expDate = new Date(item.product.expirationDate);
    const today = new Date();
    return expDate >= today && expDate <= ninetyDaysFromNow;
  }).sort((a, b) => {
    const dateA = new Date(a.product!.expirationDate!);
    const dateB = new Date(b.product!.expirationDate!);
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
          <h2 className="text-2xl font-semibold">Dashboard</h2>
        </div>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Unable to load dashboard data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <Badge variant="secondary" data-testid="text-last-updated">
          Last updated: {new Date().toLocaleDateString()}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/inventory/home")} data-testid="card-home-stock">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Home Stock</CardTitle>
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
                <span>Loading...</span>
              ) : homeLowStockCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {homeLowStockCount} low stock
                </Badge>
              ) : (
                <span className="text-green-600">All items in stock</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/inventory/car")} data-testid="card-car-stock">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Car Stock</CardTitle>
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
                <span>Loading...</span>
              ) : carLowStockCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {carLowStockCount} low stock
                </Badge>
              ) : (
                <span className="text-green-600">All items ready</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showProceduresDialog} onOpenChange={setShowProceduresDialog}>
          <DialogTrigger asChild>
            <Card className="hover-elevate cursor-pointer" data-testid="card-recent-procedures">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Procedures</CardTitle>
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
                  Last 30 days
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Recent Procedures (Last 30 Days)</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {recentProcedures.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No procedures in the last 30 days</p>
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
                      {procedure.patientId && (
                        <div className="text-sm">
                          <span className="font-medium">Patient ID:</span> {procedure.patientId}
                        </div>
                      )}
                      {procedure.notes && (
                        <div className="text-sm">
                          <span className="font-medium">Notes:</span> {procedure.notes}
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
                <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
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
                  Next 90 days
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                Expiring Products Report (Next 90 Days)
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const doc = new jsPDF();
                    
                    doc.setFontSize(18);
                    doc.text("Expiring Products Report", 14, 20);
                    doc.setFontSize(11);
                    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy")}`, 14, 28);
                    doc.text("Products expiring in the next 90 days", 14, 34);
                    
                    const tableData = expiringItems.map(item => {
                      const daysUntil = Math.ceil((new Date(item.product!.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      return [
                        item.product?.name || '',
                        item.product?.modelNumber || '',
                        item.product?.gtin || '-',
                        item.location,
                        item.quantity.toString(),
                        format(new Date(item.product!.expirationDate!), "MMM dd, yyyy"),
                        daysUntil.toString()
                      ];
                    });
                    
                    autoTable(doc, {
                      startY: 40,
                      head: [['Product', 'Model', 'GTIN', 'Location', 'Qty', 'Expiration', 'Days']],
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
                  Export PDF
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {expiringItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No items expiring in the next 90 days</p>
              ) : (
                expiringItems.map((item) => {
                  const daysUntil = Math.ceil((new Date(item.product!.expirationDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <Card key={`${item.id}-${item.location}`} data-testid={`card-expiring-${item.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-base">{item.product?.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Model: {item.product?.modelNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant={daysUntil < 30 ? "destructive" : "secondary"}>
                              {daysUntil} days
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{item.location}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <div>
                          <span className="font-medium">Expires:</span> {format(new Date(item.product!.expirationDate!), "MMM dd, yyyy")}
                        </div>
                        <div>
                          <span className="font-medium">Quantity:</span> {item.quantity}
                        </div>
                        {item.product?.gtin && (
                          <div>
                            <span className="font-medium">GTIN:</span> {item.product.gtin}
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
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/reports">
            <Button className="justify-start gap-2 w-full" data-testid="button-new-implant-report">
              <Calendar className="h-4 w-4" />
              New Implant Report
            </Button>
          </Link>
          <Link href="/transfer">
            <Button variant="secondary" className="justify-start gap-2 w-full" data-testid="button-transfer-stock">
              <Package className="h-4 w-4" />
              Transfer Stock
            </Button>
          </Link>
          <Link href="/products">
            <Button variant="outline" className="justify-start gap-2 w-full" data-testid="button-add-product">
              <Plus className="h-4 w-4" />
              Add New Product
            </Button>
          </Link>
          <Link href="/hospitals">
            <Button variant="outline" className="justify-start gap-2 w-full" data-testid="button-add-hospital">
              <Building2 className="h-4 w-4" />
              Add New Hospital
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      {!isLoading && (homeLowStockCount > 0 || carLowStockCount > 0) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {homeLowStockCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">Home inventory has {homeLowStockCount} items running low</span>
                  <Link href="/inventory/home">
                    <Button size="sm" variant="destructive" data-testid="button-view-home-alerts">
                      View Items
                    </Button>
                  </Link>
                </div>
              )}
              {carLowStockCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <span className="text-sm">Car inventory needs restocking: {carLowStockCount} items</span>
                  <Link href="/inventory/car">
                    <Button size="sm" variant="destructive" data-testid="button-view-car-alerts">
                      Restock Now
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

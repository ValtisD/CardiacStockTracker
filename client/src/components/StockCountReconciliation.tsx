import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Package, ArrowRight, Trash2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StockCountCompletionSummary } from "@/components/StockCountCompletionSummary";
import type { StockCountSession } from "@shared/schema";

interface StockCountReconciliationProps {
  session: StockCountSession;
  onComplete: () => void;
  onCancel: () => void;
}

interface Adjustment {
  transfers: { itemId: string; fromLocation: string; toLocation: string; quantity?: number }[];
  missing: { inventoryId: string; action: "mark_missing" | "derecognized" }[];
  newItems: { scannedItemId: string; location: string; quantity: number }[];
  deleteInvestigated: string[];
}

export function StockCountReconciliation({ session, onComplete, onCancel }: StockCountReconciliationProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<Adjustment>({
    transfers: [],
    missing: [],
    newItems: [],
    deleteInvestigated: [],
  });
  const [showSummary, setShowSummary] = useState(false);
  const [completionSummary, setCompletionSummary] = useState<{
    matched: number;
    transferred: number;
    newItems: number;
    markedMissing: number;
    derecognized: number;
  } | null>(null);

  // Fetch discrepancies
  const { data: discrepancies, isLoading } = useQuery({
    queryKey: ["/api/stock-count/sessions", session.id, "discrepancies"],
  });

  // Apply adjustments mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/stock-count/sessions/${session.id}/apply`, adjustments);
    },
    onSuccess: (data: any) => {
      // Invalidate all inventory-related queries to refresh the data
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/inventory') ?? false,
      });
      
      setCompletionSummary(data.summary);
      setShowSummary(true);
    },
    onError: (error: any) => {
      console.error("Stock count reconciliation error:", error);
      toast({
        variant: "destructive",
        title: t("stockCount.errors.reconciliationFailed"),
        description: error.message || t("stockCount.errors.reconciliationFailedDetails"),
      });
    },
  });

  const handleSummaryClose = () => {
    setShowSummary(false);
    onComplete();
  };

  const handleTransferItem = (scannedItemId: string, fromLocation: string, toLocation: string) => {
    setAdjustments((prev) => ({
      ...prev,
      transfers: [
        ...prev.transfers.filter((t) => t.itemId !== scannedItemId),
        { itemId: scannedItemId, fromLocation, toLocation },
      ],
      // Remove from newItems if it was previously added there
      newItems: prev.newItems.filter((n) => n.scannedItemId !== scannedItemId),
    }));
  };

  const handleMarkMissing = (inventoryId: string, action: "mark_missing" | "derecognized") => {
    setAdjustments((prev) => ({
      ...prev,
      missing: [
        ...prev.missing.filter((m) => m.inventoryId !== inventoryId),
        { inventoryId, action },
      ],
    }));
  };

  const handleAddNewItem = (scannedItemId: string, location: string, quantity: number) => {
    setAdjustments((prev) => ({
      ...prev,
      newItems: [
        ...prev.newItems.filter((n) => n.scannedItemId !== scannedItemId),
        { scannedItemId, location, quantity },
      ],
      // Remove from transfers if it was previously added there
      transfers: prev.transfers.filter((t) => t.itemId !== scannedItemId),
    }));
  };

  const handleDeleteInvestigated = (inventoryId: string) => {
    setAdjustments((prev) => ({
      ...prev,
      deleteInvestigated: [...prev.deleteInvestigated, inventoryId],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { missing = [], found = [], matched = [] } = (discrepancies || {}) as {
    missing?: any[];
    found?: any[];
    matched?: any[];
  };

  // Helper function to check if a missing item is explained by transfer action(s)
  const isMissingItemExplainedByTransfer = (missingItem: any): boolean => {
    // Aggregate all transfers that match this missing item
    let totalTransferred = 0;

    for (const transfer of adjustments.transfers) {
      // Find the found item that's being transferred
      const foundItem = found.find((f: any) => f.id === transfer.itemId);
      if (!foundItem) continue;

      // Check if the transfer is FROM the missing item's location
      if (transfer.fromLocation !== missingItem.location) continue;

      let matches = false;

      // Match by serial number (most specific) - serial items are 1:1 matches
      if (missingItem.serialNumber) {
        // If missing item has serial, found item must also have the same serial
        if (foundItem.serialNumber && missingItem.serialNumber === foundItem.serialNumber) {
          // Serial items are 1:1, so any match means it's fully explained
          return true;
        }
      }
      // Match by lot number and product (for lot-tracked items)
      else if (missingItem.lotNumber) {
        // If missing item has lot, found item must also have the same lot
        if (
          foundItem.lotNumber &&
          missingItem.lotNumber === foundItem.lotNumber &&
          missingItem.product.id === foundItem.product.id
        ) {
          matches = true;
        }
      }
      // For non-tracked items, match by product only
      else if (missingItem.product.id === foundItem.product.id) {
        // For non-tracked, check if both items have no serial/lot
        if (!foundItem.serialNumber && !foundItem.lotNumber) {
          matches = true;
        }
      }

      if (matches) {
        const transferQty = transfer.quantity || foundItem.quantity || 1;
        totalTransferred += transferQty;
      }
    }

    // For lot-tracked and non-tracked items, only hide if total transferred >= missing quantity
    if (missingItem.lotNumber || (!missingItem.serialNumber && !missingItem.lotNumber)) {
      return totalTransferred >= missingItem.quantity;
    }

    return false;
  };

  // Filter missing items to exclude those explained by transfers
  const visibleMissingItems = missing.filter(
    (item: any) => !isMissingItemExplainedByTransfer(item)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reconciliation-title">
            {t("stockCount.reconciliation.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("stockCount.reconciliation.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-back-to-scanning">
            {t("stockCount.actions.backToScanning")}
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            data-testid="button-apply-adjustments"
          >
            {applyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("stockCount.actions.applyAdjustments")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Matched Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>{t("stockCount.reconciliation.matched.title")}</CardTitle>
            </div>
            <CardDescription>
              {t("stockCount.reconciliation.matched.description")} ({matched.length})
            </CardDescription>
          </CardHeader>
          {matched.length > 0 && (
            <CardContent>
              <div className="space-y-2">
                {matched.slice(0, 5).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                    data-testid={`item-matched-${item.id}`}
                  >
                    <div>
                      <span className="font-medium">{item.product.name}</span>
                      {item.serialNumber && (
                        <span className="ml-2 font-mono text-muted-foreground">
                          {item.serialNumber}
                        </span>
                      )}
                      {item.lotNumber && (
                        <span className="ml-2 font-mono text-muted-foreground">
                          {item.lotNumber}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline">
                      {item.scannedLocation === "car"
                        ? t("stockCount.locations.car")
                        : t("stockCount.locations.home")}
                    </Badge>
                  </div>
                ))}
                {matched.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    {t("stockCount.reconciliation.andMore", { count: matched.length - 5 })}
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Found Items - Wrong Location or New */}
        {found.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <CardTitle>{t("stockCount.reconciliation.found.title")}</CardTitle>
              </div>
              <CardDescription>
                {t("stockCount.reconciliation.found.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {found.map((item: any) => {
                  const adjustment = adjustments.newItems.find((a) => a.scannedItemId === item.id);
                  const transferAdjustment = adjustments.transfers.find((t) => t.itemId === item.id);
                  
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border space-y-3"
                      data-testid={`item-found-${item.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.product.name}</p>
                            {item.existsInHome && (
                              <Badge variant="outline" className="text-xs">
                                📦 {item.scannedLocation === "car" 
                                  ? t("stockCount.reconciliation.badges.inHomeStock")
                                  : t("stockCount.reconciliation.badges.inCarStock")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.product.modelNumber}</p>
                          {item.serialNumber && (
                            <p className="text-sm font-mono mt-1">S/N: {item.serialNumber}</p>
                          )}
                          {item.lotNumber && (
                            <p className="text-sm font-mono mt-1">Lot: {item.lotNumber}</p>
                          )}
                        </div>
                        <Badge>
                          {t("stockCount.reconciliation.found.scannedIn")}{" "}
                          {item.scannedLocation === "car"
                            ? t("stockCount.locations.car")
                            : t("stockCount.locations.home")}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        {item.existsInHome ? (
                          // Item exists in other location - offer transfer or add new via dropdown
                          <Select
                            value={
                              transferAdjustment 
                                ? "transfer" 
                                : adjustment 
                                ? "addnew" 
                                : ""
                            }
                            onValueChange={(value) => {
                              if (value === "transfer") {
                                const otherLocation = item.scannedLocation === "car" ? "home" : "car";
                                handleTransferItem(item.id, otherLocation, item.scannedLocation);
                              } else if (value === "addnew") {
                                handleAddNewItem(item.id, item.scannedLocation, item.quantity);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full" data-testid={`select-action-${item.id}`}>
                              <SelectValue placeholder={t("stockCount.reconciliation.selectAction")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="transfer">
                                {item.scannedLocation === "car"
                                  ? t("stockCount.reconciliation.actions.transferFromHome")
                                  : t("stockCount.reconciliation.actions.transferFromCar")}
                              </SelectItem>
                              <SelectItem value="addnew">
                                {item.scannedLocation === "car" 
                                  ? t("stockCount.reconciliation.actions.addNewInCar")
                                  : t("stockCount.reconciliation.actions.addNewInHome")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          // Item doesn't exist elsewhere - only offer add new
                          <Select
                            value={adjustment?.location || ""}
                            onValueChange={(value) => {
                              handleAddNewItem(item.id, value, item.quantity);
                            }}
                          >
                            <SelectTrigger data-testid={`select-action-${item.id}`}>
                              <SelectValue placeholder={t("stockCount.reconciliation.selectAction")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={item.scannedLocation}>
                                {item.scannedLocation === "car" 
                                  ? t("stockCount.reconciliation.actions.addNewInCar")
                                  : t("stockCount.reconciliation.actions.addNewInHome")}
                              </SelectItem>
                              <SelectItem value={item.scannedLocation === "car" ? "home" : "car"}>
                                {item.scannedLocation === "car"
                                  ? t("stockCount.reconciliation.actions.addNewInHome")
                                  : t("stockCount.reconciliation.actions.addNewInCar")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing Items */}
        {visibleMissingItems.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle>{t("stockCount.reconciliation.missing.title")}</CardTitle>
              </div>
              <CardDescription>
                {t("stockCount.reconciliation.missing.description")} ({visibleMissingItems.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {visibleMissingItems.map((item: any) => {
                  const adjustment = adjustments.missing.find((a) => a.inventoryId === item.id);
                  const isDeleted = adjustments.deleteInvestigated.includes(item.id);

                  if (isDeleted) return null;

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border space-y-3"
                      data-testid={`item-missing-${item.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">{item.product.modelNumber}</p>
                          {item.serialNumber && (
                            <p className="text-sm font-mono mt-1">S/N: {item.serialNumber}</p>
                          )}
                          {item.lotNumber && (
                            <p className="text-sm font-mono mt-1">
                              Lot: {item.lotNumber} (Qty: {item.quantity})
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">
                          {item.location === "car"
                            ? t("stockCount.locations.car")
                            : t("stockCount.locations.home")}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Select
                          value={adjustment?.action || ""}
                          onValueChange={(value: "mark_missing" | "derecognized") =>
                            handleMarkMissing(item.id, value)
                          }
                        >
                          <SelectTrigger data-testid={`select-missing-action-${item.id}`}>
                            <SelectValue
                              placeholder={t("stockCount.reconciliation.selectAction")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mark_missing">
                              {t("stockCount.reconciliation.actions.keepForInvestigation")}
                            </SelectItem>
                            <SelectItem value="derecognized">
                              {t("stockCount.reconciliation.actions.markDerecognized")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {adjustment?.action === "mark_missing" && (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteInvestigated(item.id)}
                            data-testid={`button-delete-investigated-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Completion Summary Modal */}
      {completionSummary && (
        <StockCountCompletionSummary
          isOpen={showSummary}
          onClose={handleSummaryClose}
          summary={completionSummary}
          countType={session.countType as "car" | "total"}
        />
      )}
    </div>
  );
}

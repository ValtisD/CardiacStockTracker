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
import type { StockCountSession } from "@shared/schema";

interface StockCountReconciliationProps {
  session: StockCountSession;
  onComplete: () => void;
  onCancel: () => void;
}

interface Adjustment {
  transfers: { itemId: string; fromLocation: string; toLocation: string; quantity?: number }[];
  missing: { inventoryId: string; action: "mark_missing" | "derecognized" }[];
  newItems: { scannedItemId: string; location: string }[];
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

  // Fetch discrepancies
  const { data: discrepancies, isLoading } = useQuery({
    queryKey: ["/api/stock-count/sessions", session.id, "discrepancies"],
  });

  // Apply adjustments mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/stock-count/sessions/${session.id}/apply`, adjustments);
    },
    onSuccess: () => {
      toast({
        description: t("stockCount.messages.reconciliationComplete"),
      });
      onComplete();
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("stockCount.errors.reconciliationFailed"),
      });
    },
  });

  const handleTransferItem = (scannedItemId: string, fromLocation: string, toLocation: string) => {
    setAdjustments((prev) => ({
      ...prev,
      transfers: [
        ...prev.transfers.filter((t) => t.itemId !== scannedItemId),
        { itemId: scannedItemId, fromLocation, toLocation },
      ],
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

  const handleAddNewItem = (scannedItemId: string, location: string) => {
    setAdjustments((prev) => ({
      ...prev,
      newItems: [
        ...prev.newItems.filter((n) => n.scannedItemId !== scannedItemId),
        { scannedItemId, location },
      ],
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
                                📦 In Home Stock
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
                        <Select
                          value={adjustment?.location || transferAdjustment?.toLocation || ""}
                          onValueChange={(value) => {
                            if (value === "add_new") {
                              handleAddNewItem(item.id, item.scannedLocation);
                            } else {
                              handleTransferItem(item.id, value === "car" ? "home" : "car", value);
                            }
                          }}
                        >
                          <SelectTrigger data-testid={`select-action-${item.id}`}>
                            <SelectValue placeholder={t("stockCount.reconciliation.selectAction")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="add_new">
                              {t("stockCount.reconciliation.actions.addNew")}
                            </SelectItem>
                            <SelectItem value="car">
                              {t("stockCount.reconciliation.actions.transferToCar")}
                            </SelectItem>
                            <SelectItem value="home">
                              {t("stockCount.reconciliation.actions.transferToHome")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing Items */}
        {missing.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle>{t("stockCount.reconciliation.missing.title")}</CardTitle>
              </div>
              <CardDescription>
                {t("stockCount.reconciliation.missing.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {missing.map((item: any) => {
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
    </div>
  );
}

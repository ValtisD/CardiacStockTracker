import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StockCountScanner } from "@/components/StockCountScanner";
import { StockCountReconciliation } from "@/components/StockCountReconciliation";
import type { StockCountSession } from "@shared/schema";

type CountType = "car" | "total";

export default function StockCount() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedCountType, setSelectedCountType] = useState<CountType | null>(null);
  const [currentLocation, setCurrentLocation] = useState<"home" | "car">("car");
  const [showReconciliation, setShowReconciliation] = useState(false);

  // Fetch active session
  const { data: activeSession, isLoading: sessionLoading } = useQuery<StockCountSession | null>({
    queryKey: ["/api/stock-count/sessions/active"],
    refetchInterval: 5000,
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async (countType: CountType) => {
      return await apiRequest("POST", "/api/stock-count/sessions", {
        countType,
        status: "in_progress",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-count/sessions/active"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("stockCount.errors.startFailed"),
      });
    },
  });

  // Cancel session mutation
  const cancelSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiRequest("POST", `/api/stock-count/sessions/${sessionId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-count/sessions/active"] });
      setSelectedCountType(null);
      setShowReconciliation(false);
    },
  });

  useEffect(() => {
    if (activeSession) {
      setSelectedCountType(activeSession.countType);
    }
  }, [activeSession]);

  const handleStartSession = async (countType: CountType) => {
    setSelectedCountType(countType);
    await startSessionMutation.mutateAsync(countType);
  };

  const handleCancelSession = async () => {
    if (activeSession) {
      await cancelSessionMutation.mutateAsync(activeSession.id);
    }
  };

  const handleProceedToReconciliation = () => {
    setShowReconciliation(true);
  };

  const handleReconciliationComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/stock-count/sessions/active"] });
    queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    setSelectedCountType(null);
    setShowReconciliation(false);
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show reconciliation page
  if (showReconciliation && activeSession) {
    return (
      <StockCountReconciliation
        session={activeSession}
        onComplete={handleReconciliationComplete}
        onCancel={() => setShowReconciliation(false)}
      />
    );
  }

  // Show scanning interface if session is active
  if (activeSession) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-stock-count-title">
                {activeSession.countType === "car"
                  ? t("stockCount.title.carCount")
                  : t("stockCount.title.totalCount")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("stockCount.description.scanning")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCancelSession}
                disabled={cancelSessionMutation.isPending}
                data-testid="button-cancel-count"
              >
                {t("stockCount.actions.cancel")}
              </Button>
              <Button
                onClick={handleProceedToReconciliation}
                data-testid="button-proceed-reconciliation"
              >
                {t("stockCount.actions.proceedToReconciliation")}
              </Button>
            </div>
          </div>

          {activeSession.countType === "total" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t("stockCount.labels.currentLocation")}:</span>
              <Select
                value={currentLocation}
                onValueChange={(value) => setCurrentLocation(value as "home" | "car")}
              >
                <SelectTrigger className="w-40" data-testid="select-scan-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car" data-testid="option-location-car">
                    {t("stockCount.locations.car")}
                  </SelectItem>
                  <SelectItem value="home" data-testid="option-location-home">
                    {t("stockCount.locations.home")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <StockCountScanner
            sessionId={activeSession.id}
            scannedLocation={activeSession.countType === "car" ? "car" : currentLocation}
          />
        </div>
      </div>
    );
  }

  // Show count type selection
  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-stock-count-title">
          {t("stockCount.title.main")}
        </h1>
        <p className="text-muted-foreground">{t("stockCount.description.main")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className="hover-elevate active-elevate-2 cursor-pointer"
          onClick={() => !startSessionMutation.isPending && handleStartSession("car")}
          data-testid="card-count-type-car"
        >
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t("stockCount.countTypes.car.title")}</CardTitle>
            </div>
            <CardDescription>{t("stockCount.countTypes.car.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("stockCount.countTypes.car.features.0")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("stockCount.countTypes.car.features.1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("stockCount.countTypes.car.features.2")}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card
          className="hover-elevate active-elevate-2 cursor-pointer"
          onClick={() => !startSessionMutation.isPending && handleStartSession("total")}
          data-testid="card-count-type-total"
        >
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t("stockCount.countTypes.total.title")}</CardTitle>
            </div>
            <CardDescription>{t("stockCount.countTypes.total.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("stockCount.countTypes.total.features.0")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("stockCount.countTypes.total.features.1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t("stockCount.countTypes.total.features.2")}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {startSessionMutation.isPending && (
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("stockCount.status.starting")}</span>
        </div>
      )}
    </div>
  );
}

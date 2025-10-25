import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, ArrowRight, Package, AlertTriangle, Trash2 } from "lucide-react";

interface CompletionSummary {
  matched: number;
  transferred: number;
  newItems: number;
  markedMissing: number;
  derecognized: number;
}

interface StockCountCompletionSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  summary: CompletionSummary;
  countType: "car" | "total";
}

export function StockCountCompletionSummary({ 
  isOpen, 
  onClose, 
  summary, 
  countType 
}: StockCountCompletionSummaryProps) {
  const { t } = useTranslation();

  const totalAdjustments = summary.transferred + summary.newItems + summary.derecognized;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {t("stockCount.summary.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Count Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>{t("stockCount.summary.countType")}</CardDescription>
              <CardTitle className="text-lg">
                {countType === "car"
                  ? t("stockCount.title.carCount")
                  : t("stockCount.title.totalCount")}
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Summary Stats */}
          <div className="grid gap-3">
            {/* Matched Items */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{t("stockCount.summary.matched")}</span>
              </div>
              <span className="text-lg font-bold text-green-600">{summary.matched}</span>
            </div>

            {/* Transferred */}
            {summary.transferred > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">{t("stockCount.summary.transferred")}</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{summary.transferred}</span>
              </div>
            )}

            {/* New Items */}
            {summary.newItems > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/20">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">{t("stockCount.summary.newItems")}</span>
                </div>
                <span className="text-lg font-bold text-purple-600">{summary.newItems}</span>
              </div>
            )}

            {/* Marked Missing */}
            {summary.markedMissing > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-orange-50 dark:bg-orange-950/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">{t("stockCount.summary.markedMissing")}</span>
                </div>
                <span className="text-lg font-bold text-orange-600">{summary.markedMissing}</span>
              </div>
            )}

            {/* Derecognized */}
            {summary.derecognized > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">{t("stockCount.summary.derecognized")}</span>
                </div>
                <span className="text-lg font-bold text-red-600">{summary.derecognized}</span>
              </div>
            )}
          </div>

          {/* Total Adjustments */}
          {totalAdjustments > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("stockCount.summary.totalAdjustments")}
                </span>
                <span className="text-xl font-bold">{totalAdjustments}</span>
              </div>
            </div>
          )}

          {/* Close Button */}
          <Button 
            onClick={onClose} 
            className="w-full"
            data-testid="button-close-summary"
          >
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, CheckCircle2, Package, ArrowRight, AlertTriangle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { StockCountSession } from "@shared/schema";

export default function StockCountHistory() {
  const { t } = useTranslation();

  // Fetch stock count history
  const { data: history, isLoading } = useQuery<StockCountSession[]>({
    queryKey: ["/api/stock-count/history"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-history-title">
            {t("stockCount.history.title")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {t("stockCount.history.description")}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!history || history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <History className="h-12 w-12 mb-2 opacity-50" />
            <p>{t("stockCount.history.noHistory")}</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl">
            {history.map((session) => {
              const summary = session.completionSummary as any;
              const totalAdjustments = summary
                ? summary.transferred + summary.newItems + summary.derecognized
                : 0;

              return (
                <Card key={session.id} data-testid={`history-item-${session.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {session.countType === "car"
                            ? t("stockCount.title.carCount")
                            : t("stockCount.title.totalCount")}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("stockCount.history.completedOn")}{" "}
                          {session.completedAt
                            ? format(new Date(session.completedAt), "PPp")
                            : ""}
                        </p>
                        {session.completedBy && (
                          <p className="text-xs text-muted-foreground">
                            {t("stockCount.history.completedBy")}: {session.completedBy}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                        {t("stockCount.history.completed")}
                      </Badge>
                    </div>
                  </CardHeader>

                  {summary && (
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {/* Matched */}
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
                          <p className="text-2xl font-bold">{summary.matched}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("stockCount.summary.matched")}
                          </p>
                        </div>

                        {/* Transferred */}
                        {summary.transferred > 0 && (
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <ArrowRight className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                            <p className="text-2xl font-bold">{summary.transferred}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("stockCount.summary.transferred")}
                            </p>
                          </div>
                        )}

                        {/* New Items */}
                        {summary.newItems > 0 && (
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <Package className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                            <p className="text-2xl font-bold">{summary.newItems}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("stockCount.summary.newItems")}
                            </p>
                          </div>
                        )}

                        {/* Marked Missing */}
                        {summary.markedMissing > 0 && (
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-600" />
                            <p className="text-2xl font-bold">{summary.markedMissing}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("stockCount.summary.markedMissing")}
                            </p>
                          </div>
                        )}

                        {/* Derecognized */}
                        {summary.derecognized > 0 && (
                          <div className="text-center p-3 rounded-lg bg-muted/50">
                            <Trash2 className="h-5 w-5 mx-auto mb-1 text-red-600" />
                            <p className="text-2xl font-bold">{summary.derecognized}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("stockCount.summary.derecognized")}
                            </p>
                          </div>
                        )}
                      </div>

                      {totalAdjustments > 0 && (
                        <div className="mt-3 pt-3 border-t text-center">
                          <span className="text-sm text-muted-foreground">
                            {t("stockCount.summary.totalAdjustments")}:{" "}
                          </span>
                          <span className="text-lg font-bold">{totalAdjustments}</span>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

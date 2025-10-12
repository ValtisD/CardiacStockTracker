import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product, UserProductSettings } from "@shared/schema";

interface SettingsFormData {
  productId: string;
  minCarStock: number | undefined;
  minTotalStock: number | undefined;
}

export default function UserProductSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pendingChanges, setPendingChanges] = useState<Map<string, SettingsFormData>>(new Map());
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<UserProductSettings[]>({
    queryKey: ["/api/user-product-settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      setSavingProductId(data.productId);
      const res = await apiRequest("PUT", `/api/user-product-settings/${data.productId}`, {
        minCarStock: data.minCarStock ?? 0,
        minTotalStock: data.minTotalStock ?? 0,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-product-settings"] });
      toast({
        title: t("common.success"),
        description: t("settings.thresholdsUpdated"),
      });
      // Clear pending changes only after successful save
      const newChanges = new Map(pendingChanges);
      newChanges.delete(variables.productId);
      setPendingChanges(newChanges);
      setSavingProductId(null);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message || t("settings.updateFailed"),
        variant: "destructive",
      });
      setSavingProductId(null);
    },
  });

  const handleInputChange = (productId: string, field: 'minCarStock' | 'minTotalStock', value: number | undefined) => {
    const currentSettings = settings?.find(s => s.productId === productId);
    const current = pendingChanges.get(productId) || {
      productId,
      minCarStock: currentSettings?.minCarStock ?? 0,
      minTotalStock: currentSettings?.minTotalStock ?? 0,
    };

    setPendingChanges(new Map(pendingChanges.set(productId, {
      ...current,
      [field]: value,
    })));
  };

  const handleSave = (productId: string) => {
    const data = pendingChanges.get(productId);
    if (data) {
      updateMutation.mutate(data);
    }
  };

  const getDisplayValue = (productId: string, field: 'minCarStock' | 'minTotalStock'): number | string => {
    const pending = pendingChanges.get(productId);
    if (pending) {
      return pending[field] ?? "";
    }
    const currentSettings = settings?.find(s => s.productId === productId);
    return currentSettings?.[field] ?? 0;
  };

  const hasPendingChanges = (productId: string): boolean => {
    return pendingChanges.has(productId);
  };

  if (productsLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("settings.loading")}</p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Settings className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p>{t("settings.noProducts")}</p>
        <p className="text-sm mt-2">{t("settings.noProductsHelp")}</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t("settings.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("settings.description")}
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("settings.product")}</TableHead>
              <TableHead>{t("settings.modelNumber")}</TableHead>
              <TableHead className="text-center">{t("settings.minCarStock")}</TableHead>
              <TableHead className="text-center">{t("settings.minTotalStock")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} data-testid={`row-settings-${product.id}`}>
                <TableCell className="font-medium" data-testid={`text-product-name-${product.id}`}>
                  {product.name}
                </TableCell>
                <TableCell data-testid={`text-model-${product.id}`}>
                  {product.modelNumber}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Input
                      type="number"
                      min="0"
                      className="w-20 text-center"
                      value={getDisplayValue(product.id, 'minCarStock')}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          handleInputChange(product.id, 'minCarStock', undefined);
                        } else {
                          const parsed = Number(value);
                          handleInputChange(product.id, 'minCarStock', Number.isNaN(parsed) ? undefined : parsed);
                        }
                      }}
                      onBlur={() => {
                        const pending = pendingChanges.get(product.id);
                        if (pending && pending.minCarStock === undefined) {
                          handleInputChange(product.id, 'minCarStock', 0);
                        }
                      }}
                      data-testid={`input-min-car-${product.id}`}
                      disabled={savingProductId === product.id}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Input
                      type="number"
                      min="0"
                      className="w-20 text-center"
                      value={getDisplayValue(product.id, 'minTotalStock')}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          handleInputChange(product.id, 'minTotalStock', undefined);
                        } else {
                          const parsed = Number(value);
                          handleInputChange(product.id, 'minTotalStock', Number.isNaN(parsed) ? undefined : parsed);
                        }
                      }}
                      onBlur={() => {
                        const pending = pendingChanges.get(product.id);
                        if (pending && pending.minTotalStock === undefined) {
                          handleInputChange(product.id, 'minTotalStock', 0);
                        }
                      }}
                      data-testid={`input-min-total-${product.id}`}
                      disabled={savingProductId === product.id}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    onClick={() => handleSave(product.id)}
                    disabled={!hasPendingChanges(product.id) || savingProductId === product.id}
                    data-testid={`button-save-${product.id}`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {savingProductId === product.id ? t("settings.saving") : t("common.save")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

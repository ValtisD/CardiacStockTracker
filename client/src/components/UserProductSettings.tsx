import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Save } from "lucide-react";
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
  minCarStock: number;
  minTotalStock: number;
}

export default function UserProductSettings() {
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
        minCarStock: data.minCarStock,
        minTotalStock: data.minTotalStock,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-product-settings"] });
      toast({
        title: "Success",
        description: "Stock thresholds updated successfully",
      });
      // Clear pending changes only after successful save
      const newChanges = new Map(pendingChanges);
      newChanges.delete(variables.productId);
      setPendingChanges(newChanges);
      setSavingProductId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stock thresholds",
        variant: "destructive",
      });
      setSavingProductId(null);
    },
  });

  const handleInputChange = (productId: string, field: 'minCarStock' | 'minTotalStock', value: number) => {
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

  const getDisplayValue = (productId: string, field: 'minCarStock' | 'minTotalStock'): number => {
    const pending = pendingChanges.get(productId);
    if (pending) {
      return pending[field];
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
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Settings className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p>No products available.</p>
        <p className="text-sm mt-2">Products must be added by an administrator before you can configure stock thresholds.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Stock Alert Thresholds
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure minimum stock levels for each product. You'll receive alerts when stock falls below these thresholds.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Model Number</TableHead>
              <TableHead className="text-center">Min Car Stock</TableHead>
              <TableHead className="text-center">Min Total Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                      onChange={(e) => handleInputChange(product.id, 'minCarStock', parseInt(e.target.value) || 0)}
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
                      onChange={(e) => handleInputChange(product.id, 'minTotalStock', parseInt(e.target.value) || 0)}
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
                    {savingProductId === product.id ? "Saving..." : "Save"}
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

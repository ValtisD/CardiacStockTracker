import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Edit, Trash2, Package } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Product } from "@shared/schema";
import ProductForm from "@/components/ProductForm";

export default function ProductsList() {
  const { t } = useTranslation();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();
  const { user } = useAuth0();
  
  const adminEmail = import.meta.env.VITE_AUTH0_ADMIN_EMAIL || import.meta.env.AUTH0_ADMIN_EMAIL;
  const isAdmin = user?.email === adminEmail;

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: t("common.success"),
        description: t("products.deleteSuccess"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message || t("products.deleteFailed"),
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm(t("products.confirmDelete"))) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditSuccess = () => {
    setEditingProduct(null);
  };

  if (editingProduct) {
    return (
      <div className="p-6">
        <ProductForm
          product={editingProduct}
          onSuccess={handleEditSuccess}
          onCancel={() => setEditingProduct(null)}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("products.loading")}</p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p>{t("products.noProductsFound")}</p>
        <p className="text-sm mt-2">{t("products.addFirstProduct")}</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.gtin")}</TableHead>
              <TableHead>{t("products.modelNumber")}</TableHead>
              <TableHead>{t("products.productName")}</TableHead>
              {isAdmin && <TableHead className="text-right">{t("common.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                <TableCell className="font-medium" data-testid={`text-gtin-${product.id}`}>
                  {product.gtin}
                </TableCell>
                <TableCell data-testid={`text-model-${product.id}`}>
                  {product.modelNumber}
                </TableCell>
                <TableCell data-testid={`text-product-name-${product.id}`}>
                  {product.name}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingProduct(product)}
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product.id)}
                        data-testid={`button-delete-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Edit, Trash2, Package, Search, MoreVertical, Barcode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: currentUser } = useQuery<{ userId: string; email: string; isAdmin: boolean; isPrimeAdmin: boolean }>({
    queryKey: ["/api/user/me"],
  });

  const isAdmin = currentUser?.isAdmin || false;

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
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

  // Filter and sort products alphabetically by name
  const filteredProducts = products
    .filter(product => {
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        product.modelNumber.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t("products.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-products"
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p>{t("products.noProductsFound")}</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} data-testid={`card-product-${product.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h3 className="font-semibold truncate mb-1">{product.name}</h3>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{product.name}</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Barcode className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="font-mono text-xs">{product.gtin}</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">{t("products.model")}:</span> {product.modelNumber}
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`button-menu-${product.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingProduct(product)} data-testid={`menu-edit-${product.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(product.id)} className="text-destructive" data-testid={`menu-delete-${product.id}`}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
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
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                      <TableCell className="font-medium font-mono text-sm" data-testid={`text-gtin-${product.id}`}>
                        {product.gtin}
                      </TableCell>
                      <TableCell data-testid={`text-model-${product.id}`}>
                        {product.modelNumber}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{product.name}</p>
                          </TooltipContent>
                        </Tooltip>
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
        </>
      )}
    </div>
  );
}

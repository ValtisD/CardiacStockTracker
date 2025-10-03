import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Edit, Trash2, Package } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Product } from "@shared/schema";
import ProductForm from "@/components/ProductForm";

export default function ProductsList() {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

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
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
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
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p>No products found.</p>
        <p className="text-sm mt-2">Click "Add Product" to add your first medical device.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Model Number</TableHead>
              <TableHead>GTIN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                <TableCell className="font-medium" data-testid={`text-product-name-${product.id}`}>
                  {product.name}
                </TableCell>
                <TableCell data-testid={`text-model-${product.id}`}>
                  {product.modelNumber}
                </TableCell>
                <TableCell data-testid={`text-gtin-${product.id}`}>
                  {product.gtin || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" data-testid={`badge-category-${product.id}`}>
                    {product.category}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`text-manufacturer-${product.id}`}>
                  {product.manufacturer}
                </TableCell>
                <TableCell data-testid={`text-serial-${product.id}`}>
                  {product.serialNumber || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingProduct(product)}
                      data-testid={`button-edit-${product.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(product.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${product.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

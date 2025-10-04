import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Package, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertProductSchema, type Product, type InsertProduct } from "@shared/schema";
import BarcodeScanner from "@/components/BarcodeScanner";
import type { GS1Data } from "@/lib/gs1Parser";

interface ProductFormProps {
  product?: Product;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const { toast } = useToast();
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      gtin: product?.gtin || "",
      modelNumber: product?.modelNumber || "",
      name: product?.name || "",
    },
  });

  const handleScanComplete = (barcode: string, productInfo?: Product, gs1Data?: GS1Data) => {
    // Extract GTIN from GS1 data if available, otherwise use the barcode directly
    const gtin = gs1Data?.gtin || barcode;
    form.setValue("gtin", gtin);
    setShowBarcodeScanner(false);
    
    toast({
      title: "Barcode scanned",
      description: `GTIN: ${gtin}`,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      if (!product?.id) throw new Error("Product ID is required for updates");
      const res = await apiRequest("PATCH", `/api/products/${product.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertProduct) => {
    if (product) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {product ? 'Edit Product' : 'Add New Product'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="gtin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GTIN</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input 
                        placeholder="e.g., 05414734218320" 
                        {...field} 
                        data-testid="input-gtin"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowBarcodeScanner(true)}
                      disabled={isSubmitting}
                      data-testid="button-scan-gtin"
                    >
                      <Scan className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., XT1234" 
                      {...field} 
                      data-testid="input-model-number"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Medtronic Azure Pacemaker" 
                      {...field} 
                      data-testid="input-product-name"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  data-testid="button-cancel"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button 
                type="submit" 
                data-testid="button-save-product"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : (product ? 'Update Product' : 'Add Product')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScanComplete={handleScanComplete}
        title="Scan Product Barcode (GTIN)"
      />
    </Card>
  );
}

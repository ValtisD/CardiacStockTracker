import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, FileText, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Inventory, Product, ImplantProcedure, Hospital } from "@shared/schema";

interface QuickSearchProps {
  onProcedureSelect?: (procedureId: string) => void;
}

interface SearchResult {
  inventoryItems: (Inventory & { product: Product })[];
  procedures: (ImplantProcedure & { hospital: Hospital; deviceProduct?: Product | null })[];
}

export default function QuickSearch({ onProcedureSelect }: QuickSearchProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState<string>("");

  const { data: searchResults, isLoading, error } = useQuery<SearchResult>({
    queryKey: ['/api/quick-search', activeSearch],
    enabled: activeSearch.length > 0,
  });

  const handleSearch = () => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      toast({
        title: t('common.error'),
        description: t('search.enterSearchQuery'),
        variant: "destructive",
      });
      return;
    }
    setActiveSearch(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleInventoryClick = (item: Inventory & { product: Product }) => {
    // Navigate to the inventory page based on location
    setLocation(`/inventory/${item.location}`);
    setSearchQuery("");
    setActiveSearch("");
    
    toast({
      title: t('search.foundInInventory'),
      description: `${item.product.name} - ${item.location === 'car' ? t('inventory.carStock') : t('inventory.homeStock')}`,
    });
  };

  const handleProcedureClick = (procedure: ImplantProcedure & { hospital: Hospital }) => {
    if (onProcedureSelect) {
      onProcedureSelect(procedure.id);
    }
    setSearchQuery("");
    setActiveSearch("");
    
    toast({
      title: t('search.foundInProcedure'),
      description: `${t('procedures.procedure')} ${t('common.at')} ${procedure.hospital.name}`,
    });
  };

  const hasResults = searchResults && (searchResults.inventoryItems.length > 0 || searchResults.procedures.length > 0);
  const showNoResults = activeSearch.length > 0 && !isLoading && !hasResults;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('search.quickSearchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
                data-testid="input-quick-search"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isLoading || searchQuery.trim().length === 0}
              data-testid="button-quick-search"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {showNoResults && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t('search.noResultsFound')} "{activeSearch}"
            </p>
          </CardContent>
        </Card>
      )}

      {/* Inventory Results */}
      {searchResults && searchResults.inventoryItems.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('search.foundInInventory')}
            </h3>
            {searchResults.inventoryItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer"
                onClick={() => handleInventoryClick(item)}
                data-testid={`result-inventory-${item.id}`}
              >
                <div className="flex-1">
                  <p className="font-medium">{item.product.name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                    {item.serialNumber && (
                      <Badge variant="secondary" className="text-xs">
                        {t('inventory.serial')}: {item.serialNumber}
                      </Badge>
                    )}
                    {item.lotNumber && (
                      <Badge variant="secondary" className="text-xs">
                        {t('inventory.lot')}: {item.lotNumber}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge variant={item.location === 'car' ? 'default' : 'outline'}>
                  {item.location === 'car' ? t('inventory.carStock') : t('inventory.homeStock')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Procedure Results */}
      {searchResults && searchResults.procedures.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('search.foundInProcedures')}
            </h3>
            {searchResults.procedures.map((procedure) => (
              <div
                key={procedure.id}
                className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer"
                onClick={() => handleProcedureClick(procedure)}
                data-testid={`result-procedure-${procedure.id}`}
              >
                <div className="flex-1">
                  <p className="font-medium">{procedure.hospital.name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                    <span>{new Date(procedure.implantDate).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{procedure.procedureType}</span>
                  </div>
                </div>
                <Badge variant="outline">{t('procedures.procedure')}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

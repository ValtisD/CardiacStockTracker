import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import { Settings as SettingsIcon, Globe, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UserProductSettings from "@/components/UserProductSettings";

interface LanguageResponse {
  language: string;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { getAccessTokenSilently } = useAuth0();
  const [activeTab, setActiveTab] = useState("language");

  const { data: languageData } = useQuery<LanguageResponse>({
    queryKey: ['/api/user/language'],
  });

  const updateLanguageMutation = useMutation({
    mutationFn: async (language: string) => {
      const token = await getAccessTokenSilently();
      const res = await fetch('/api/user/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ language }),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to update language');
      }
      
      return res.json();
    },
    onSuccess: (data: LanguageResponse) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/language'] });
      i18n.changeLanguage(data.language);
      toast({
        title: t('common.success'),
        description: t('settings.updateSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('settings.updateFailed'),
        variant: 'destructive',
      });
    },
  });

  const handleLanguageChange = (language: string) => {
    updateLanguageMutation.mutate(language);
  };

  return (
    <div className="p-3 md:p-6">
      <div className="flex items-center gap-2 mb-4 md:mb-6">
        <SettingsIcon className="h-5 md:h-6 w-5 md:w-6" />
        <h2 className="text-xl md:text-2xl font-semibold">{t('settings.title')}</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
        <TabsList>
          <TabsTrigger value="language" data-testid="tab-language">
            <Globe className="h-4 w-4 mr-2" />
            {t('settings.languageSettings')}
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="h-4 w-4 mr-2" />
            {t('settings.productSettings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="language" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('settings.preferences')}
              </CardTitle>
              <CardDescription>
                {t('settings.selectLanguage')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">{t('settings.language')}</Label>
                <Select
                  value={languageData?.language || i18n.language || 'de'}
                  onValueChange={handleLanguageChange}
                  disabled={updateLanguageMutation.isPending}
                >
                  <SelectTrigger id="language" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de" data-testid="option-language-de">
                      🇩🇪 {t('settings.german')}
                    </SelectItem>
                    <SelectItem value="en" data-testid="option-language-en">
                      🇬🇧 {t('settings.english')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <UserProductSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

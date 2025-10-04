import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LanguageResponse {
  language: string;
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const { data: languageData } = useQuery<LanguageResponse>({
    queryKey: ['/api/user/language'],
  });

  const updateLanguageMutation = useMutation({
    mutationFn: async (language: string) => {
      const response = await fetch('/api/user/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ language }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update language');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
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
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="h-6 w-6" />
        <h2 className="text-2xl font-semibold">{t('settings.title')}</h2>
      </div>

      <div className="space-y-6">
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
      </div>
    </div>
  );
}

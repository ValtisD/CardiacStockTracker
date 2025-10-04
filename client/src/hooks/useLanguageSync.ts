import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

interface LanguageResponse {
  language: string;
}

export function useLanguageSync() {
  const { i18n } = useTranslation();
  
  const { data: languageData } = useQuery<LanguageResponse>({
    queryKey: ['/api/user/language'],
    staleTime: Infinity,
  });

  useEffect(() => {
    if (languageData?.language && languageData.language !== i18n.language) {
      i18n.changeLanguage(languageData.language);
    }
  }, [languageData, i18n]);

  return { currentLanguage: languageData?.language || i18n.language };
}

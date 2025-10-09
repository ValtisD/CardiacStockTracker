import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2 } from "lucide-react";

export default function RegistrationGate() {
  const { loginWithRedirect } = useAuth0();
  const { t } = useTranslation();
  const [secretWord, setSecretWord] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!secretWord.trim()) {
      setError(t('registration.secretWordRequired'));
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch('/api/auth/validate-secret-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secretWord: secretWord.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.valid && data.validationToken) {
        // Server has generated and stored a validation token
        // Store it locally to pass to Auth0
        sessionStorage.setItem('registration_validation_token', data.validationToken);
        
        // Redirect to Auth0 signup with server-generated token in state
        await loginWithRedirect({
          authorizationParams: {
            screen_hint: 'signup',
          },
          appState: {
            validationToken: data.validationToken,
            isNewSignup: true,
          },
        });
      } else {
        setError(t('registration.invalidSecretWord'));
        setSecretWord("");
      }
    } catch (err) {
      console.error('Validation error:', err);
      setError(t('registration.validationFailed'));
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('registration.title')}</CardTitle>
          <CardDescription>{t('registration.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secretWord">{t('registration.secretWordLabel')}</Label>
              <Input
                id="secretWord"
                type="password"
                value={secretWord}
                onChange={(e) => setSecretWord(e.target.value)}
                placeholder={t('registration.secretWordPlaceholder')}
                disabled={isValidating}
                data-testid="input-secret-word"
                autoFocus
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription data-testid="text-error">{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={isValidating}
                data-testid="button-validate"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('registration.validating')}
                  </>
                ) : (
                  t('registration.continue')
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => window.location.href = '/'}
                disabled={isValidating}
                data-testid="button-back-to-login"
              >
                {t('registration.backToLogin')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

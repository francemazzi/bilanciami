import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSettings, setOpenaiApiKey, deleteOpenaiApiKey } from '@/api/settings';
import { useSettingsStore } from '@/stores/settings.store';
import { Key, Eye, EyeOff, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export function SettingsPage() {
  const { hasOpenaiApiKey, openaiApiKeyLastChars, setSettings, setLoading } = useSettingsStore();
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsPageLoading(true);
    setLoading(true);
    try {
      const settings = await getSettings();
      setSettings(settings.hasOpenaiApiKey, settings.openaiApiKeyLastChars);
    } catch {
      toast.error('Errore nel caricamento delle impostazioni');
    } finally {
      setIsPageLoading(false);
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      toast.error('Inserisci una chiave API');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      toast.error('La chiave API deve iniziare con "sk-"');
      return;
    }

    setIsSaving(true);
    try {
      await setOpenaiApiKey(apiKey);
      await loadSettings();
      setApiKey('');
      toast.success('Chiave API salvata con successo');
    } catch {
      toast.error('Errore nel salvataggio della chiave API');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Sei sicuro di voler eliminare la chiave API? Non potrai piu estrarre fatture fino a quando non ne inserisci una nuova.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOpenaiApiKey();
      setSettings(false);
      toast.success('Chiave API eliminata');
    } catch {
      toast.error("Errore nell'eliminazione della chiave API");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Impostazioni</h1>
        <p className="text-muted-foreground">
          Gestisci le tue impostazioni e la chiave API OpenAI.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5" />
              <CardTitle>Chiave API OpenAI</CardTitle>
            </div>
            <CardDescription>
              Necessaria per l'estrazione automatica delle fatture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasOpenaiApiKey && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">
                    Chiave API non configurata
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Per utilizzare l'estrazione fatture devi configurare la tua chiave API OpenAI.
                    Puoi ottenerla su{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-900"
                    >
                      platform.openai.com
                    </a>
                  </p>
                </div>
              </div>
            )}

            {hasOpenaiApiKey && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-800 font-medium">
                    Chiave API configurata
                  </p>
                  <p className="text-sm text-green-700">
                    Chiave attiva: ****{openaiApiKeyLastChars}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="apiKey" className="text-sm font-medium">
                  {hasOpenaiApiKey ? 'Sostituisci chiave API' : 'Inserisci chiave API'}
                </label>
                <div className="relative">
                  <input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={!apiKey.trim() || isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Salvataggio...' : 'Salva'}
                </Button>
                {hasOpenaiApiKey && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isDeleting ? 'Eliminazione...' : 'Elimina'}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Sicurezza</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>La chiave API viene criptata prima di essere salvata nel database</li>
              <li>Non viene mai mostrata in chiaro dopo il salvataggio</li>
              <li>Viene usata solo per le tue richieste di estrazione</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

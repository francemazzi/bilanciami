import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getSettings,
  setOpenaiApiKey,
  deleteOpenaiApiKey,
  updateLLMProviderSettings,
  getOllamaModels,
  testOllamaConnection,
  type LLMProviderType,
  type OllamaModel,
} from '@/api/settings';
import { useSettingsStore } from '@/stores/settings.store';
import {
  Key,
  Eye,
  EyeOff,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Server,
  Cloud,
  Cpu,
  RefreshCw,
} from 'lucide-react';

export function SettingsPage() {
  const {
    hasOpenaiApiKey,
    openaiApiKeyLastChars,
    llmProvider,
    ollamaBaseUrl,
    ollamaTextModel,
    ollamaVisionModel,
    setSettings,
    setLoading,
  } = useSettingsStore();

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ollama state
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderType>(llmProvider);
  const [ollamaUrl, setOllamaUrl] = useState(ollamaBaseUrl);
  const [ollamaText, setOllamaText] = useState(ollamaTextModel);
  const [ollamaVision, setOllamaVision] = useState(ollamaVisionModel);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [isSavingProvider, setIsSavingProvider] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setSelectedProvider(llmProvider);
    setOllamaUrl(ollamaBaseUrl);
    setOllamaText(ollamaTextModel);
    setOllamaVision(ollamaVisionModel);
  }, [llmProvider, ollamaBaseUrl, ollamaTextModel, ollamaVisionModel]);

  const loadSettings = async () => {
    setIsPageLoading(true);
    setLoading(true);
    try {
      const settings = await getSettings();
      setSettings(settings);
    } catch {
      toast.error('Errore nel caricamento delle impostazioni');
    } finally {
      setIsPageLoading(false);
      setLoading(false);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
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

  const handleDeleteApiKey = async () => {
    if (
      !confirm(
        'Sei sicuro di voler eliminare la chiave API? Non potrai piu estrarre fatture con OpenAI fino a quando non ne inserisci una nuova.'
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOpenaiApiKey();
      setSettings({ hasOpenaiApiKey: false, openaiApiKeyLastChars: undefined });
      toast.success('Chiave API eliminata');
    } catch {
      toast.error("Errore nell'eliminazione della chiave API");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestOllama = async () => {
    setIsTestingOllama(true);
    setOllamaConnected(null);
    try {
      const result = await testOllamaConnection(ollamaUrl);
      setOllamaConnected(result.success);
      if (result.success) {
        toast.success('Connessione a Ollama riuscita');
        // Load models
        const modelsResult = await getOllamaModels();
        setAvailableModels(modelsResult.models);
      } else {
        toast.error(`Connessione fallita: ${result.error}`);
      }
    } catch {
      setOllamaConnected(false);
      toast.error('Errore nel test della connessione');
    } finally {
      setIsTestingOllama(false);
    }
  };

  const handleSaveProvider = async () => {
    setIsSavingProvider(true);
    try {
      await updateLLMProviderSettings({
        llmProvider: selectedProvider,
        ollamaBaseUrl: ollamaUrl,
        ollamaTextModel: ollamaText,
        ollamaVisionModel: ollamaVision,
      });
      setSettings({
        llmProvider: selectedProvider,
        ollamaBaseUrl: ollamaUrl,
        ollamaTextModel: ollamaText,
        ollamaVisionModel: ollamaVision,
      });
      toast.success('Impostazioni provider salvate');
    } catch {
      toast.error('Errore nel salvataggio delle impostazioni');
    } finally {
      setIsSavingProvider(false);
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
          Gestisci le tue impostazioni e il provider LLM per l'estrazione fatture.
        </p>
      </div>

      <div className="space-y-6">
        {/* LLM Provider Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5" />
              <CardTitle>Provider LLM</CardTitle>
            </div>
            <CardDescription>Scegli il servizio da utilizzare per l'estrazione delle fatture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedProvider('openai')}
                className={`p-4 border-2 rounded-lg text-left transition-colors ${
                  selectedProvider === 'openai'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">OpenAI</span>
                </div>
                <p className="text-sm text-muted-foreground">Cloud-based, richiede API key</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedProvider('ollama')}
                className={`p-4 border-2 rounded-lg text-left transition-colors ${
                  selectedProvider === 'ollama'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">Ollama</span>
                </div>
                <p className="text-sm text-muted-foreground">Locale, gratuito, privacy</p>
              </button>
            </div>

            {selectedProvider !== llmProvider && (
              <Button onClick={handleSaveProvider} disabled={isSavingProvider}>
                <Save className="h-4 w-4 mr-2" />
                {isSavingProvider ? 'Salvataggio...' : 'Salva provider'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* OpenAI Configuration */}
        {selectedProvider === 'openai' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5" />
                <CardTitle>Chiave API OpenAI</CardTitle>
              </div>
              <CardDescription>Necessaria per l'estrazione automatica delle fatture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasOpenaiApiKey && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Chiave API non configurata</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Per utilizzare l'estrazione fatture devi configurare la tua chiave API OpenAI. Puoi
                      ottenerla su{' '}
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
                    <p className="text-sm text-green-800 font-medium">Chiave API configurata</p>
                    <p className="text-sm text-green-700">Chiave attiva: ****{openaiApiKeyLastChars}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveApiKey} className="space-y-4">
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
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={!apiKey.trim() || isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Salvataggio...' : 'Salva'}
                  </Button>
                  {hasOpenaiApiKey && (
                    <Button type="button" variant="destructive" onClick={handleDeleteApiKey} disabled={isDeleting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isDeleting ? 'Eliminazione...' : 'Elimina'}
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Ollama Configuration */}
        {selectedProvider === 'ollama' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5" />
                <CardTitle>Configurazione Ollama</CardTitle>
              </div>
              <CardDescription>Configura la connessione al server Ollama locale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">Nota sulle performance</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Con CPU only l'estrazione richiede 30-60 secondi per pagina. Per performance migliori si
                    consiglia una GPU NVIDIA.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="ollamaUrl" className="text-sm font-medium">
                  URL Server Ollama
                </label>
                <div className="flex gap-2">
                  <input
                    id="ollamaUrl"
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://ollama:11434"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <Button type="button" variant="outline" onClick={handleTestOllama} disabled={isTestingOllama}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isTestingOllama ? 'animate-spin' : ''}`} />
                    {isTestingOllama ? 'Test...' : 'Test'}
                  </Button>
                </div>
              </div>

              {ollamaConnected === true && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-800 font-medium">Connesso a Ollama</p>
                    <p className="text-sm text-green-700">{availableModels.length} modelli disponibili</p>
                  </div>
                </div>
              )}

              {ollamaConnected === false && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">Connessione fallita</p>
                    <p className="text-sm text-red-700">Verifica che Ollama sia in esecuzione</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="ollamaText" className="text-sm font-medium">
                    Modello Testo
                  </label>
                  {availableModels.length > 0 ? (
                    <select
                      id="ollamaText"
                      value={ollamaText}
                      onChange={(e) => setOllamaText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      {availableModels.map((model) => (
                        <option key={model.name} value={model.name}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="ollamaText"
                      type="text"
                      value={ollamaText}
                      onChange={(e) => setOllamaText(e.target.value)}
                      placeholder="llama3.2:3b"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="ollamaVision" className="text-sm font-medium">
                    Modello Vision
                  </label>
                  {availableModels.length > 0 ? (
                    <select
                      id="ollamaVision"
                      value={ollamaVision}
                      onChange={(e) => setOllamaVision(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      {availableModels.map((model) => (
                        <option key={model.name} value={model.name}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="ollamaVision"
                      type="text"
                      value={ollamaVision}
                      onChange={(e) => setOllamaVision(e.target.value)}
                      placeholder="llava:7b-v1.6-mistral-q4_K_M"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>

              {(ollamaUrl !== ollamaBaseUrl ||
                ollamaText !== ollamaTextModel ||
                ollamaVision !== ollamaVisionModel) && (
                <Button onClick={handleSaveProvider} disabled={isSavingProvider}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingProvider ? 'Salvataggio...' : 'Salva configurazione'}
                </Button>
              )}

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Modelli consigliati per CPU</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    <strong>Testo:</strong> llama3.2:3b (~2GB)
                  </li>
                  <li>
                    <strong>Vision:</strong> llava:7b-v1.6-mistral-q4_K_M (~4.5GB)
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Scarica i modelli con: <code>docker exec ollama ollama pull [model]</code>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Sicurezza</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>La chiave API viene criptata prima di essere salvata nel database</li>
              <li>Non viene mai mostrata in chiaro dopo il salvataggio</li>
              <li>Viene usata solo per le tue richieste di estrazione</li>
              {selectedProvider === 'ollama' && <li>Con Ollama i dati non escono dalla tua rete locale</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

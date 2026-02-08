import { useState, useCallback } from "react";
import {
  sendChatMessage,
  approveOperation,
  rejectOperation,
  type ChatResponse,
  type PendingQuery,
} from "../api/chat";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  pendingQuery?: PendingQuery;
  needsApproval?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  threadId: string | null;
  pendingApproval: PendingQuery | null;
  sendMessage: (message: string) => Promise<void>;
  approve: (feedback?: string) => Promise<void>;
  reject: (feedback?: string) => Promise<void>;
  clearChat: () => void;
}

/**
 * Hook per gestire lo stato della chat
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingQuery | null>(
    null
  );

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string, extra?: Partial<ChatMessage>) => {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
        ...extra,
      };
      setMessages((prev) => [...prev, message]);
      return message;
    },
    []
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      setError(null);
      setIsLoading(true);

      // Aggiungi messaggio utente
      addMessage("user", message);

      try {
        const response: ChatResponse = await sendChatMessage({
          message,
          threadId: threadId || undefined,
        });

        // Salva threadId per continuare la conversazione
        setThreadId(response.threadId);

        // Aggiungi risposta assistente
        addMessage("assistant", response.response, {
          needsApproval: response.needsApproval,
          pendingQuery: response.pendingQuery,
        });

        // Se richiede approvazione, salva query pendente
        if (response.needsApproval && response.pendingQuery) {
          setPendingApproval(response.pendingQuery);
        }

        // Gestisci errori nella risposta
        if (response.errors && response.errors.length > 0) {
          setError(response.errors.join(", "));
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Errore sconosciuto";
        setError(errorMessage);
        addMessage(
          "assistant",
          `Mi dispiace, si è verificato un errore: ${errorMessage}`
        );
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, addMessage]
  );

  const approve = useCallback(
    async (feedback?: string) => {
      if (!threadId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await approveOperation(threadId, feedback);

        // Rimuovi pending approval
        setPendingApproval(null);

        // Aggiungi risposta
        addMessage("assistant", response.response);

        if (response.errors && response.errors.length > 0) {
          setError(response.errors.join(", "));
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Errore sconosciuto";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, addMessage]
  );

  const reject = useCallback(
    async (feedback?: string) => {
      if (!threadId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await rejectOperation(threadId, feedback);

        // Rimuovi pending approval
        setPendingApproval(null);

        // Aggiungi risposta
        addMessage("assistant", response.response);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Errore sconosciuto";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, addMessage]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setThreadId(null);
    setPendingApproval(null);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    threadId,
    pendingApproval,
    sendMessage,
    approve,
    reject,
    clearChat,
  };
}

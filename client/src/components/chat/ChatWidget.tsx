import { useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ApprovalDialog } from "./ApprovalDialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, X, Trash2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatWidget({ isOpen, onClose }: ChatWidgetProps) {
  const {
    messages,
    isLoading,
    error,
    pendingApproval,
    sendMessage,
    approve,
    reject,
    clearChat,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <Card
      className={cn(
        "fixed bottom-4 right-4 w-[400px] h-[600px] max-h-[80vh]",
        "flex flex-col shadow-2xl z-50",
        "animate-in slide-in-from-bottom-4 fade-in duration-200"
      )}
    >
      {/* Header */}
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">Assistente Contabile</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            title="Nuova conversazione"
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg">Ciao! Come posso aiutarti?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Puoi chiedermi informazioni sulle tue fatture, fornitori, scadenze
              e molto altro.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>Prova a chiedere:</p>
              <ul className="space-y-1">
                <li>"Quali fatture sono scadute?"</li>
                <li>"Chi sono i miei migliori fornitori?"</li>
                <li>"Quanto devo incassare questo mese?"</li>
                <li>"Genera un sollecito per [cliente]"</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Approval Dialog */}
      {pendingApproval && (
        <div className="p-4 border-t">
          <ApprovalDialog
            pendingQuery={pendingApproval}
            onApprove={approve}
            onReject={reject}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Input */}
      {!pendingApproval && (
        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          placeholder={
            isLoading ? "Elaborazione in corso..." : "Scrivi un messaggio..."
          }
        />
      )}
    </Card>
  );
}

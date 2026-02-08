/**
 * Tipi per l'assistente chat contabile
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    sqlQuery?: string;
    queryResult?: unknown;
    needsApproval?: boolean;
  };
}

export interface ChatThread {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  threadId?: string;
}

export interface ChatResponse {
  response: string;
  threadId: string;
  needsApproval: boolean;
  pendingQuery?: {
    sql: string;
    description: string;
    sensitiveReason?: string;
  };
  errors?: string[];
}

export interface ApprovalRequest {
  threadId: string;
  approved: boolean;
  feedback?: string;
}

export interface ApprovalResponse {
  response: string;
  threadId: string;
  errors?: string[];
}

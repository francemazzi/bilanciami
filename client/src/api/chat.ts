import { apiRequest } from "./client";

export interface ChatRequest {
  message: string;
  threadId?: string;
}

export interface PendingQuery {
  sql: string;
  description: string;
  sensitiveReason?: string;
}

export interface ChatResponse {
  response: string;
  threadId: string;
  needsApproval: boolean;
  pendingQuery?: PendingQuery;
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

/**
 * Invia un messaggio all'assistente chat
 */
export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Approva un'operazione sensibile in attesa
 */
export async function approveOperation(
  threadId: string,
  feedback?: string
): Promise<ApprovalResponse> {
  return apiRequest<ApprovalResponse>("/chat/approve", {
    method: "POST",
    body: JSON.stringify({
      threadId,
      approved: true,
      feedback,
    }),
  });
}

/**
 * Rifiuta un'operazione sensibile in attesa
 */
export async function rejectOperation(
  threadId: string,
  feedback?: string
): Promise<ApprovalResponse> {
  return apiRequest<ApprovalResponse>("/chat/approve", {
    method: "POST",
    body: JSON.stringify({
      threadId,
      approved: false,
      feedback,
    }),
  });
}

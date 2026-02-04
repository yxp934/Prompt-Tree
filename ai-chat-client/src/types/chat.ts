export type ChatRole = "system" | "user" | "assistant";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessageContent = string | ChatContentPart[];

export interface ChatMessage {
  role: ChatRole;
  content: ChatMessageContent;
}

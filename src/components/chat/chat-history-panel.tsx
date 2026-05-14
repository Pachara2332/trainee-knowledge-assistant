import type { ChatConversation } from "./types";

export function ChatHistoryPanel({
  conversations,
  activeConversationId,
  isStreaming,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: {
  conversations: ChatConversation[];
  activeConversationId: string;
  isStreaming: boolean;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}) {
  return (
    <div className="border-b-4 border-[#1C1B1A] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="comic-impact border-2 border-[#1C1B1A] bg-[#C89B3C] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#1C1B1A] shadow-[4px_4px_0_#1C1B1A] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          disabled={isStreaming}
          onClick={onNewChat}
        >
          New Chat
        </button>

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex max-w-56 shrink-0 items-stretch border-2 border-[#1C1B1A] shadow-[3px_3px_0_#4F6F86] ${
                conversation.id === activeConversationId
                  ? "bg-[#1C1B1A] text-white"
                  : "bg-[#E7E1D6] text-[#1C1B1A]"
              }`}
            >
              <button
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs font-black uppercase tracking-wider disabled:cursor-not-allowed"
                type="button"
                disabled={isStreaming}
                title={conversation.title}
                onClick={() => onSelectConversation(conversation.id)}
              >
                {conversation.title}
              </button>
              <button
                className="border-l-2 border-[#1C1B1A] px-2 text-xs font-black text-[#8E3A3A] disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={isStreaming}
                title={`Delete ${conversation.title}`}
                onClick={() => onDeleteConversation(conversation.id)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

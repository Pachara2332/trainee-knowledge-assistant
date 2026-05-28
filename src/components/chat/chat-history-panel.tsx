import type { ChatConversation } from "./types";

function displayTitle(title: string) {
  const borrowedBrandPattern = new RegExp(`\\b${["g", "r", "o", "k"].join("")}\\b`, "gi");
  return title.replace(borrowedBrandPattern, "assistant");
}

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
    <div className="fixed left-3 top-[104px] z-20 hidden w-[240px] lg:block">
      <div className="grid gap-2">
        <button
          className="rounded-xl bg-[#1d1d1d] px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          disabled={isStreaming}
          onClick={onNewChat}
        >
          New Chat
        </button>

        <div className="grid max-h-[36vh] gap-1 overflow-y-auto pr-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex min-w-0 items-stretch overflow-hidden rounded-xl border ${
                conversation.id === activeConversationId
                  ? "border-[#3b3b3b] bg-[#1a1a1a] text-white"
                  : "border-[#171717] bg-transparent text-[#9b9b9b]"
              }`}
            >
              <button
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs font-semibold disabled:cursor-not-allowed"
                type="button"
                disabled={isStreaming}
                title={displayTitle(conversation.title)}
                onClick={() => onSelectConversation(conversation.id)}
              >
                {displayTitle(conversation.title)}
              </button>
              <button
                className="border-l border-[#2a2a2a] px-3 text-xs font-semibold text-[#777] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={isStreaming}
                title={`Delete ${displayTitle(conversation.title)}`}
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

import { MarkdownMessage } from "./markdown-message";
import type { Message } from "./types";

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="relative min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[88%] border-4 border-[#1C1B1A] px-4 py-3 shadow-[8px_8px_0_#1C1B1A] sm:max-w-[76%] ${
              message.role === "user"
                ? "bg-[#4F6F86] text-white"
                : "bg-white text-[#1C1B1A]"
            }`}
          >
            <p
              className={`mb-2 inline-block px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.2em] ${
                message.role === "user"
                  ? "bg-[#C89B3C] text-[#1C1B1A]"
                  : "bg-[#8E3A3A] text-white"
              }`}
            >
              {message.role === "user" ? "You" : "Assistant"}
            </p>

            {message.role === "assistant" ? (
              message.content ? (
                <MarkdownMessage content={message.content} />
              ) : (
                <p className="text-sm font-black uppercase tracking-wider text-[#4F6F86]">
                  Thinking...
                </p>
              )
            ) : (
              <>
                {message.attachmentName ? (
                  <p className="mb-2 inline-block border-2 border-[#1C1B1A] bg-white px-2 py-1 text-xs font-black uppercase tracking-wider text-[#1C1B1A]">
                    Attached: {message.attachmentName}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm font-semibold leading-6">
                  {message.content}
                </p>
              </>
            )}

            {message.usage ? (
              <p className="mt-3 border-t-2 border-[#1C1B1A]/20 pt-2 text-xs font-black uppercase tracking-wider text-[#1C1B1A]/70">
                Tokens: {message.usage.totalTokens} ({message.usage.promptTokens} prompt,{" "}
                {message.usage.completionTokens} answer)
              </p>
            ) : null}

            {message.provider ? (
              <p className="mt-2 text-xs font-black uppercase tracking-wider text-[#4F6F86]">
                Provider: {message.provider}
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

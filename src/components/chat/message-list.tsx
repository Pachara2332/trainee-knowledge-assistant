import { MarkdownMessage } from "./markdown-message";
import type { Message } from "./types";

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="relative flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[88%] border-4 border-[#111111] px-4 py-3 shadow-[8px_8px_0_#111111] sm:max-w-[76%] ${
              message.role === "user"
                ? "bg-[#2986CC] text-white"
                : "bg-white text-[#111111]"
            }`}
          >
            <p
              className={`mb-2 inline-block px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.2em] ${
                message.role === "user"
                  ? "bg-[#FBB829] text-[#111111]"
                  : "bg-[#B91C1C] text-white"
              }`}
            >
              {message.role === "user" ? "You" : "Assistant"}
            </p>

            {message.role === "assistant" ? (
              message.content ? (
                <MarkdownMessage content={message.content} />
              ) : (
                <p className="text-sm font-black uppercase tracking-wider text-[#2986CC]">
                  Thinking...
                </p>
              )
            ) : (
              <>
                {message.attachmentName ? (
                  <p className="mb-2 inline-block border-2 border-[#111111] bg-white px-2 py-1 text-xs font-black uppercase tracking-wider text-[#111111]">
                    Attached: {message.attachmentName}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm font-semibold leading-6">
                  {message.content}
                </p>
              </>
            )}

            {message.usage ? (
              <p className="mt-3 border-t-2 border-[#111111]/20 pt-2 text-xs font-black uppercase tracking-wider text-[#111111]/70">
                Tokens: {message.usage.totalTokens} ({message.usage.promptTokens} prompt,{" "}
                {message.usage.completionTokens} answer)
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

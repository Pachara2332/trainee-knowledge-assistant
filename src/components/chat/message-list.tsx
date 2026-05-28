import { MarkdownMessage } from "./markdown-message";
import type { Message } from "./types";

export function MessageList({ messages }: { messages: Message[] }) {
  const isEmptyChat =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].id === "welcome");

  if (isEmptyChat) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-border bg-surface text-2xl font-semibold text-foreground">
            K
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Knowledge
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto min-h-0 w-full max-w-4xl flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
      {messages.filter((message) => message.id !== "welcome").map((message) => (
        <article
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[88%] rounded-3xl border px-4 py-3 sm:max-w-[76%] ${
              message.role === "user"
                ? "border-border bg-surface text-foreground"
                : "border-transparent bg-transparent text-foreground"
            }`}
          >
            <p
              className="mb-2 inline-block text-[0.72rem] font-semibold text-muted"
            >
              {message.role === "user" ? "You" : "Assistant"}
            </p>

            {message.role === "assistant" ? (
              message.content ? (
                <MarkdownMessage content={message.content} />
              ) : (
                <p className="text-sm font-semibold text-muted">
                  Thinking...
                </p>
              )
            ) : (
              <>
                {message.attachmentName ? (
                  <p className="mb-2 inline-block rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted">
                    Attached: {message.attachmentName}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-foreground">
                  {message.content}
                </p>
              </>
            )}

            {message.usage ? (
              <p className="mt-3 border-t border-border pt-2 text-xs font-semibold text-muted">
                Tokens: {message.usage.totalTokens} ({message.usage.promptTokens} prompt,{" "}
                {message.usage.completionTokens} answer)
              </p>
            ) : null}

            {message.provider ? (
              <p className="mt-2 text-xs font-semibold text-muted">
                Provider: {message.provider}
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

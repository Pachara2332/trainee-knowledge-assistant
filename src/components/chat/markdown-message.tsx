function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={`${part}-${index}`}
              className="border border-[#1C1B1A] bg-[#C89B3C] px-1 py-0.5 font-mono text-[0.9em] font-bold text-[#1C1B1A]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-3 text-sm leading-6">
      {blocks.map((block, blockIndex) => {
        const trimmed = block.trim();

        if (!trimmed) {
          return null;
        }

        if (trimmed.startsWith("```")) {
          return (
            <pre
              key={`${trimmed}-${blockIndex}`}
              className="overflow-x-auto border-2 border-[#1C1B1A] bg-[#1C1B1A] p-3 text-xs text-[#E7E1D6] shadow-[5px_5px_0_#4F6F86]"
            >
              <code>{trimmed.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "")}</code>
            </pre>
          );
        }

        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={`${trimmed}-${blockIndex}`}
              className="text-lg font-black uppercase text-[#1C1B1A]"
            >
              {trimmed.slice(2)}
            </h2>
          );
        }

        const lines = trimmed.split("\n");
        const isList = lines.every((line) => /^[-*]\s+/.test(line.trim()));

        if (isList) {
          return (
            <ul
              key={`${trimmed}-${blockIndex}`}
              className="list-disc space-y-1 pl-5"
            >
              {lines.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`}>
                  <InlineMarkdown text={line.replace(/^[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${trimmed}-${blockIndex}`} className="whitespace-pre-wrap">
            <InlineMarkdown text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

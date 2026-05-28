export function TokenUsageBadge({ totalTokens }: { totalTokens: number }) {
  return (
    <div className="rounded-full border border-[#222] bg-[#0b0b0b] px-3 py-1.5 text-xs font-semibold text-[#bfbfbf]">
      {totalTokens} tokens
    </div>
  );
}

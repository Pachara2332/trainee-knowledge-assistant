export function TokenUsageBadge({ totalTokens }: { totalTokens: number }) {
  return (
    <div className="border-2 border-[#C89B3C] bg-[#18202B] px-3 py-2 font-black uppercase tracking-wider text-[#C89B3C] shadow-[4px_4px_0_#4F6F86]">
      Session tokens: {totalTokens}
    </div>
  );
}

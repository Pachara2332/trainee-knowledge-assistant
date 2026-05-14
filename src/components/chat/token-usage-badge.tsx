export function TokenUsageBadge({ totalTokens }: { totalTokens: number }) {
  return (
    <div className="border-2 border-[#FBB829] bg-[#0F172A] px-3 py-2 font-black uppercase tracking-wider text-[#FBB829] shadow-[4px_4px_0_#2986CC]">
      Session tokens: {totalTokens}
    </div>
  );
}

import { ChangeEvent, FormEvent, RefObject } from "react";
import type { ClientAttachment } from "./types";

export function ChatComposer({
  input,
  attachedFile,
  isStreaming,
  fileInputRef,
  onInputChange,
  onFileChange,
  onRemoveFile,
  onSubmit,
  onStop,
}: {
  input: string;
  attachedFile: ClientAttachment | null;
  isStreaming: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
}) {
  return (
    <form className="border-t-4 border-[#111111] bg-white p-4" onSubmit={onSubmit}>
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={onFileChange}
      />

      {attachedFile ? (
        <div className="mb-3 inline-flex max-w-full items-center gap-3 border-2 border-[#111111] bg-[#E5E7EB] px-3 py-2 text-xs font-black uppercase tracking-wider shadow-[4px_4px_0_#2986CC]">
          <span className="truncate">{attachedFile.name}</span>
          <button
            className="bg-[#B91C1C] px-2 py-1 text-white"
            type="button"
            onClick={onRemoveFile}
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex min-h-16 items-end gap-3 border-4 border-[#111111] bg-[#E5E7EB] p-2 transition focus-within:bg-white focus-within:shadow-[6px_6px_0_#2986CC]">
          <button
            className="comic-impact grid h-11 w-11 shrink-0 place-items-center border-4 border-[#111111] bg-white text-xl font-black text-[#111111] shadow-[4px_4px_0_#2986CC]"
            type="button"
            title="Attach PDF or TXT"
            onClick={() => fileInputRef.current?.click()}
          >
            +
          </button>
          <textarea
            className="min-h-11 flex-1 resize-none bg-transparent px-1 py-2 text-sm font-semibold text-[#111111] outline-none"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Punch in a question or attach TXT/PDF..."
            rows={2}
          />
        </div>
        {isStreaming ? (
          <button
            className="comic-impact min-h-14 border-4 border-[#111111] bg-[#B91C1C] px-6 text-sm font-black uppercase tracking-wider text-white shadow-[7px_7px_0_#111111]"
            type="button"
            onClick={onStop}
          >
            Stop
          </button>
        ) : (
          <button
            className="comic-impact min-h-14 border-4 border-[#111111] bg-[#FBB829] px-8 text-sm font-black uppercase tracking-wider text-[#111111] shadow-[7px_7px_0_#111111] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </div>
    </form>
  );
}

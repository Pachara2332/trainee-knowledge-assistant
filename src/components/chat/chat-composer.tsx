import { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
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
  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      isStreaming ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form className="border-t-4 border-[#1C1B1A] bg-white p-4" onSubmit={onSubmit}>
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={onFileChange}
      />

      {attachedFile ? (
        <div className="mb-3 inline-flex max-w-full items-center gap-3 border-2 border-[#1C1B1A] bg-[#E7E1D6] px-3 py-2 text-xs font-black uppercase tracking-wider shadow-[4px_4px_0_#4F6F86]">
          <span className="truncate">{attachedFile.name}</span>
          <button
            className="bg-[#8E3A3A] px-2 py-1 text-white"
            type="button"
            onClick={onRemoveFile}
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex min-h-16 items-end gap-3 border-4 border-[#1C1B1A] bg-[#E7E1D6] p-2 transition focus-within:bg-white focus-within:shadow-[6px_6px_0_#4F6F86]">
          <button
            className="comic-impact grid h-11 w-11 shrink-0 place-items-center border-4 border-[#1C1B1A] bg-white text-xl font-black text-[#1C1B1A] shadow-[4px_4px_0_#4F6F86]"
            type="button"
            title="Attach PDF or TXT"
            onClick={() => fileInputRef.current?.click()}
          >
            +
          </button>
          <textarea
            className="min-h-11 flex-1 resize-none bg-transparent px-1 py-2 text-sm font-semibold text-[#1C1B1A] outline-none"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Punch in a question or attach TXT/PDF..."
            rows={2}
          />
        </div>
        {isStreaming ? (
          <button
            className="comic-impact min-h-14 border-4 border-[#1C1B1A] bg-[#8E3A3A] px-6 text-sm font-black uppercase tracking-wider text-white shadow-[7px_7px_0_#1C1B1A]"
            type="button"
            onClick={onStop}
          >
            Stop
          </button>
        ) : (
          <button
            className="comic-impact min-h-14 border-4 border-[#1C1B1A] bg-[#C89B3C] px-8 text-sm font-black uppercase tracking-wider text-[#1C1B1A] shadow-[7px_7px_0_#1C1B1A] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </div>
    </form>
  );
}

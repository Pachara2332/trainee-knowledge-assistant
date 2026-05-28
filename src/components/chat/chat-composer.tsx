import { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import type { ClientAttachment } from "./types";

export function ChatComposer({
  input,
  attachedFile,
  isStreaming,
  isCentered = false,
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
  isCentered?: boolean;
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
    <form
      className={isCentered ? "w-full px-4 sm:px-8" : "px-4 pb-5 sm:px-8"}
      onSubmit={onSubmit}
    >
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={onFileChange}
      />

      {attachedFile ? (
        <div className="mx-auto mb-3 flex max-w-[800px] items-center gap-3 rounded-2xl border border-[#2a2a2a] bg-[#111] px-3 py-2 text-xs font-semibold text-[#d0d0d0]">
          <span className="truncate">{attachedFile.name}</span>
          <button
            className="ml-auto rounded-full px-3 py-1 text-[#9b9b9b] transition hover:bg-[#1d1d1d] hover:text-white"
            type="button"
            onClick={onRemoveFile}
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="mx-auto flex h-[64px] max-w-[800px] items-center gap-2 rounded-[32px] border border-[#2a2a2a] bg-[#181818] px-4 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.28)] transition focus-within:border-[#4a4a4a]">
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-2xl leading-none text-[#f1f1f1] transition hover:bg-[#252525]"
          type="button"
          title="Attach PDF or TXT"
          onClick={() => fileInputRef.current?.click()}
        >
          +
        </button>
        <textarea
          className="h-10 max-h-10 min-h-10 flex-1 resize-none bg-transparent px-1 py-[10px] text-sm font-semibold leading-5 text-white outline-none placeholder:text-[#8d8d8d]"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="How can I help you today?"
          rows={1}
        />
        {isStreaming ? (
          <button
            className="grid h-10 shrink-0 place-items-center rounded-full border border-[#3a3a3a] px-5 text-sm font-semibold text-white transition hover:bg-[#252525]"
            type="button"
            onClick={onStop}
          >
            Stop
          </button>
        ) : (
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-base font-semibold text-black transition hover:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:bg-[#2a2a2a] disabled:text-[#777]"
            disabled={!input.trim()}
            title="Send"
          >
            &uarr;
          </button>
        )}
      </div>
    </form>
  );
}

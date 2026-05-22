export function parseSseEvents(buffer: string) {
  const events = buffer.split("\n\n");
  const rest = events.pop() ?? "";

  return {
    events: events.map((event) => {
      const name =
        event
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim() ?? "message";
      const data = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");

      return { name, data };
    }),
    rest,
  };
}

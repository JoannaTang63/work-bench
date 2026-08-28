import { useState } from "react";
import { QUOTES, randomQuote } from "../lib/quotes";

export default function QuoteCard() {
  const [{ quote, index }, setState] = useState(() => randomQuote());

  function refresh() {
    setState(randomQuote(index));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-4">
        <blockquote className="flex-1">
          <p className="text-lg italic leading-relaxed text-slate-700 dark:text-slate-200">“{quote.text}”</p>
          <footer className="mt-2 text-sm text-slate-500 dark:text-slate-400">— {quote.author}</footer>
        </blockquote>
        <button
          onClick={refresh}
          title="换一条"
          className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          换一条
        </button>
      </div>
      <p className="mt-3 text-right text-[10px] text-slate-300 dark:text-slate-600">{index + 1} / {QUOTES.length}</p>
    </section>
  );
}

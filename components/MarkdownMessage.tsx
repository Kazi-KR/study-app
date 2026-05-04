"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders an assistant message body as markdown so **bold**, *italics*, lists,
// `inline code`, fenced code blocks, links, blockquotes, and tables all show
// up correctly. Used in:
//   - app/task/TaskClient.tsx (real participant chat)
//   - app/preview/PreviewClient.tsx (researcher preview)
//
// The component overrides below give every element Tailwind classes that fit
// the chat-bubble context (compact spacing, no big top/bottom margins, dark
// mode aware). We pass a plain string in — the markdown only ever comes from
// the assistant, never from raw user input, so XSS isn't a concern (and
// react-markdown is sanitised by default anyway).
export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs: bubble already has padding, so we only need vertical
        // spacing *between* paragraphs, not above the first / below the last.
        p: ({ children }) => (
          <p className="leading-6 [&:not(:first-child)]:mt-2">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        // Inline code: a soft background that adapts to whichever bubble it's
        // inside (user = inverted, assistant = light). Use a neutral grey so
        // it reads on both.
        code: ({ children, className }) => {
          // react-markdown v10 passes className for fenced blocks (e.g.
          // "language-js") but inline code has no className. Distinguishing
          // here lets us style the two cases separately.
          const isInline = !className;
          if (isInline) {
            return (
              <code className="rounded bg-black/10 px-1 py-0.5 text-[0.85em] font-mono dark:bg-white/15">
                {children}
              </code>
            );
          }
          return <code className={`${className} font-mono`}>{children}</code>;
        },
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-md bg-black/5 p-3 text-xs leading-5 dark:bg-white/10">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="my-1.5 list-disc pl-5 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1.5 list-decimal pl-5 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-6">{children}</li>,
        h1: ({ children }) => (
          <h1 className="mt-2 text-base font-semibold">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-2 text-sm font-semibold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-2 text-sm font-semibold">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="mt-2 text-sm font-semibold">{children}</h4>
        ),
        h5: ({ children }) => (
          <h5 className="mt-2 text-sm font-semibold">{children}</h5>
        ),
        h6: ({ children }) => (
          <h6 className="mt-2 text-sm font-semibold">{children}</h6>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-1.5 border-l-2 border-current/30 pl-3 italic opacity-90">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:no-underline"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-current/20" />,
        // GFM tables — keep a minimal footprint so they don't blow out the
        // chat bubble width. Outer wrapper enables horizontal scroll on
        // overflow; inner table uses light borders.
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-black/5 dark:bg-white/10">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-current/20 px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-current/20 px-2 py-1 align-top">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

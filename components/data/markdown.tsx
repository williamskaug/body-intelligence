import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Single markdown renderer for all read-only document views (briefings,
// memory docs, plan cards). Server-rendered — react-markdown is sync in
// RSC and never touches dangerouslySetInnerHTML. GFM enables the tables
// the briefings lean on.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:leading-relaxed prose-table:text-xs prose-th:font-medium prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

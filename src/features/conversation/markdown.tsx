import type { CSSProperties, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const prismStyle: Record<string, CSSProperties> = solarizedlight as unknown as Record<string, CSSProperties>;

const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className']],
    pre: [...(defaultSchema.attributes?.pre || []), ['className']],
  },
};

const escapeHtmlTagLines = (markdown: string) => {
  if (!markdown) return markdown;
  const lines = markdown.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^\s*<\/?[A-Za-z][A-Za-z0-9_-]*>\s*$/.test(line)) {
      lines[i] = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }
  return lines.join('\n');
};

export const mdastToText = (node: any): string => {
  if (!node) return '';
  switch (node.type) {
    case 'root':
      return node.children
        .map(mdastToText)
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd();
    case 'text':
      return node.value;
    case 'inlineCode':
      return node.value;
    case 'code':
      return `${node.value}\n`;
    case 'break':
      return '\n';
    case 'paragraph':
    case 'heading':
      return `${node.children.map(mdastToText).join('')}\n\n`;
    case 'list':
      return `${node.children.map(mdastToText).join('')}\n`;
    case 'listItem':
      return `${node.children.map(mdastToText).join('')}\n`;
    case 'blockquote':
      return `${node.children.map(mdastToText).join('')}\n\n`;
    case 'thematicBreak':
      return '\n\n';
    case 'table':
      return `${node.children.map(mdastToText).join('')}\n`;
    case 'tableRow':
      return `${node.children.map(mdastToText).join('\t')}\n`;
    case 'tableCell':
      return node.children.map(mdastToText).join('');
    case 'html':
      return node.value || '';
    default:
      if (node.children) return node.children.map(mdastToText).join('');
      return '';
  }
};

export const markdownToPlainText = async (markdown: string) => {
  const normalized = escapeHtmlTagLines(markdown);
  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(normalized);
  return mdastToText(tree);
};

export const renderSnippet = (snippet?: string | null) => {
  if (!snippet) return null;
  const nodes: ReactNode[] = [];
  const regex = /\[\[(.+?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let key = 0;

  while (true) {
    match = regex.exec(snippet);
    if (!match) break;
    const matchStart = match.index;
    if (matchStart > lastIndex) {
      nodes.push(<span key={`snippet-${key++}`}>{snippet.slice(lastIndex, matchStart)}</span>);
    }
    nodes.push(
      <mark key={`snippet-${key++}`} className="rounded bg-amber-200/70 px-1 text-slate-900">
        {match[1]}
      </mark>,
    );
    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < snippet.length) {
    nodes.push(<span key={`snippet-${key++}`}>{snippet.slice(lastIndex)}</span>);
  }

  return nodes;
};

export const MarkdownBlock = ({ content }: { content: string }) => {
  const normalized = escapeHtmlTagLines(content);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, markdownSchema]]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          if (match) {
            return (
              <div className="overflow-x-auto rounded-xl bg-white/70">
                <SyntaxHighlighter
                  style={prismStyle}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '12px',
                    background: 'transparent',
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                  codeTagProps={{ style: { fontFamily: '"JetBrains Mono", monospace' } }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className="inline-code" {...props}>
              {children}
            </code>
          );
        },
        ul({ children }) {
          return <ul className="list-disc">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal">{children}</ol>;
        },
        p({ children }) {
          return <p>{children}</p>;
        },
        li({ children }) {
          return <li>{children}</li>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-slate-300 pl-4 text-slate-600">{children}</blockquote>;
        },
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
};

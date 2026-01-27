import type { CSSProperties, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const prismStyle: Record<string, CSSProperties> = solarizedlight as unknown as Record<string, CSSProperties>;

const markdownSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'mark'],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className']],
    pre: [...(defaultSchema.attributes?.pre || []), ['className']],
    mark: [...(defaultSchema.attributes?.mark || []), ['className']],
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
    if (/^\s*<\/?[A-Za-z][A-Za-z0-9_-]*(\s+[^>]+)?>\s*$/.test(line)) {
      lines[i] = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }
  return lines.join('\n');
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const splitInlineCodeSegments = (line: string) => {
  const segments: Array<{ text: string; isCode: boolean }> = [];
  let lastIndex = 0;
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') {
      i += 1;
      continue;
    }
    let runLength = 1;
    while (i + runLength < line.length && line[i + runLength] === '`') {
      runLength += 1;
    }
    const openStart = i;
    const openEnd = i + runLength;
    let closeIndex = -1;
    let j = openEnd;
    while (j < line.length) {
      if (line[j] !== '`') {
        j += 1;
        continue;
      }
      let closeLength = 1;
      while (j + closeLength < line.length && line[j + closeLength] === '`') {
        closeLength += 1;
      }
      if (closeLength === runLength) {
        closeIndex = j;
        break;
      }
      j += closeLength;
    }
    if (closeIndex === -1) {
      i = openEnd;
      continue;
    }
    if (openStart > lastIndex) {
      segments.push({ text: line.slice(lastIndex, openStart), isCode: false });
    }
    const codeEnd = closeIndex + runLength;
    segments.push({ text: line.slice(openStart, codeEnd), isCode: true });
    i = codeEnd;
    lastIndex = codeEnd;
  }
  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), isCode: false });
  }
  return segments;
};

const splitLinkUrlSegments = (text: string) => {
  const segments: Array<{ text: string; isUrl: boolean }> = [];
  let lastIndex = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\\\') {
      i += 2;
      continue;
    }
    const isImage = text[i] === '!' && text[i + 1] === '[';
    const isLinkStart = text[i] === '[' || isImage;
    if (!isLinkStart) {
      i += 1;
      continue;
    }
    const labelStart = isImage ? i + 2 : i + 1;
    let j = labelStart;
    let labelFound = false;
    while (j < text.length) {
      if (text[j] === '\\\\') {
        j += 2;
        continue;
      }
      if (text[j] === ']') {
        labelFound = true;
        break;
      }
      j += 1;
    }
    if (!labelFound || text[j + 1] !== '(') {
      i = labelFound ? j + 1 : i + 1;
      continue;
    }
    const urlStart = j + 2;
    let depth = 1;
    let k = urlStart;
    while (k < text.length) {
      if (text[k] === '\\\\') {
        k += 2;
        continue;
      }
      if (text[k] === '(') {
        depth += 1;
        k += 1;
        continue;
      }
      if (text[k] === ')') {
        depth -= 1;
        if (depth === 0) break;
        k += 1;
        continue;
      }
      k += 1;
    }
    if (depth !== 0) {
      i = j + 1;
      continue;
    }
    if (urlStart > lastIndex) {
      segments.push({ text: text.slice(lastIndex, urlStart), isUrl: false });
    }
    segments.push({ text: text.slice(urlStart, k), isUrl: true });
    lastIndex = k;
    i = k;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isUrl: false });
  }
  return segments;
};

const highlightMarkdown = (markdown: string, tokens: string[]) => {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) return markdown;
  uniqueTokens.sort((a, b) => b.length - a.length);
  const pattern = uniqueTokens.map(escapeRegex).join('|');
  if (!pattern) return markdown;
  const regex = new RegExp(`(${pattern})`, 'gi');
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
    if (/^( {4}|\t)/.test(line)) continue;
    const segments = splitInlineCodeSegments(line);
    lines[i] = segments
      .map((segment) =>
        segment.isCode
          ? segment.text
          : splitLinkUrlSegments(segment.text)
              .map((linkSegment) =>
                linkSegment.isUrl
                  ? linkSegment.text
                  : linkSegment.text.replace(
                      regex,
                      '<mark class="match-highlight rounded bg-amber-200/70 px-1 text-slate-900">$1</mark>',
                    ),
              )
              .join(''),
      )
      .join('');
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
  const normalized = snippet
    .replace(/\s+/g, ' ')
    .replace(/(.)\1{4,}/g, '$1…')
    .trim();
  const nodes: ReactNode[] = [];
  const regex = /\[\[(.+?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let key = 0;

  while (true) {
    match = regex.exec(normalized);
    if (!match) break;
    const matchStart = match.index;
    if (matchStart > lastIndex) {
      nodes.push(<span key={`snippet-${key++}`}>{normalized.slice(lastIndex, matchStart)}</span>);
    }
    nodes.push(
      <mark key={`snippet-${key++}`} className="rounded bg-amber-200/70 px-1 text-slate-900">
        {match[1]}
      </mark>,
    );
    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < normalized.length) {
    nodes.push(<span key={`snippet-${key++}`}>{normalized.slice(lastIndex)}</span>);
  }

  return nodes;
};

export const MarkdownBlock = ({ content, highlightTokens }: { content: string; highlightTokens?: string[] }) => {
  const normalized = escapeHtmlTagLines(content);
  const highlighted =
    highlightTokens && highlightTokens.length > 0 ? highlightMarkdown(normalized, highlightTokens) : normalized;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema]]}
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
      {highlighted}
    </ReactMarkdown>
  );
};

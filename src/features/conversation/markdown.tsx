import { type CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

const prismStyle: Record<string, CSSProperties> =
  solarizedlight as unknown as Record<string, CSSProperties>

const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className']],
    pre: [...(defaultSchema.attributes?.pre || []), ['className']],
  },
}

export const mdastToText = (node: any): string => {
  if (!node) return ''
  switch (node.type) {
    case 'root':
      return node.children.map(mdastToText).join('').replace(/\n{3,}/g, '\n\n').trimEnd()
    case 'text':
      return node.value
    case 'inlineCode':
      return node.value
    case 'code':
      return `${node.value}\n`
    case 'break':
      return '\n'
    case 'paragraph':
    case 'heading':
      return `${node.children.map(mdastToText).join('')}\n\n`
    case 'list':
      return `${node.children.map(mdastToText).join('')}\n`
    case 'listItem':
      return `${node.children.map(mdastToText).join('')}\n`
    case 'blockquote':
      return `${node.children.map(mdastToText).join('')}\n\n`
    case 'thematicBreak':
      return '\n\n'
    case 'table':
      return `${node.children.map(mdastToText).join('')}\n`
    case 'tableRow':
      return `${node.children.map(mdastToText).join('\t')}\n`
    case 'tableCell':
      return node.children.map(mdastToText).join('')
    default:
      if (node.children) return node.children.map(mdastToText).join('')
      return ''
  }
}

export const markdownToPlainText = async (markdown: string) => {
  const processor = unified().use(remarkParse).use(remarkGfm)
  const tree = processor.parse(markdown)
  return mdastToText(tree)
}

export const renderSnippet = (snippet?: string | null) => {
  if (!snippet) return null
  const parts = snippet.split(/\[\[|\]\]/g)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded bg-amber-200/70 px-1 text-slate-900">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

export const MarkdownBlock = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, markdownSchema]]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          if (match) {
            return (
              <div className="overflow-x-auto rounded-xl bg-white/70">
                <SyntaxHighlighter
                  style={prismStyle}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: '12px', background: 'transparent' }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            )
          }
          return (
            <code className="rounded bg-white/70 px-1 py-0.5 text-xs" {...props}>
              {children}
            </code>
          )
        },
        ul({ children }) {
          return <ul className="ml-6 list-disc space-y-1">{children}</ul>
        },
        ol({ children }) {
          return <ol className="ml-6 list-decimal space-y-1">{children}</ol>
        },
        p({ children }) {
          return <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
        },
        li({ children }) {
          return <li className="whitespace-pre-wrap">{children}</li>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-slate-300 pl-4 text-slate-600 whitespace-pre-wrap">
              {children}
            </blockquote>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

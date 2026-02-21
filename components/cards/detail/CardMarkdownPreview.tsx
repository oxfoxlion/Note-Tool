'use client';

import MDEditor from '@uiw/react-md-editor';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../../../lib/markdownSanitize';
import type { InputHTMLAttributes } from 'react';

type CardMarkdownPreviewProps = {
  text: string;
  onToggleTaskAtIndex: (index: number) => void;
  onOpenCard?: (id: number) => void;
};

type MarkdownInputProps = InputHTMLAttributes<HTMLInputElement> & {
  node?: {
    position?: {
      start?: {
        offset?: number;
        line?: number;
      };
    };
  };
};

const findTaskIndexByOffset = (source: string, offset: number) => {
  const taskPattern = /^(\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*)/gm;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = taskPattern.exec(source))) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) return index;
    if (offset < start) return index;
    index += 1;
  }
  return -1;
};

const prepareMarkdown = (text: string) => text.replace(/@\[\[(\d+)\|([^\]]+)\]\]/g, '[@$2](/cards/$1)');

export default function CardMarkdownPreview({ text, onToggleTaskAtIndex, onOpenCard }: CardMarkdownPreviewProps) {
  const preparedSource = prepareMarkdown(text);
  const taskLineNumbers = text
    .split('\n')
    .map((line, idx) => (line.match(/^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s+/) ? idx + 1 : null))
    .filter((line): line is number => line !== null);

  return (
    <MDEditor.Markdown
      source={preparedSource}
      wrapperElement={{ 'data-color-mode': 'light' }}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
      components={{
        a: ({ href, children, ...props }) => {
          const match = href?.match(/^\/cards\/(\d+)(?:[/?#].*)?$/);
          if (match && onOpenCard) {
            return (
              <a
                {...props}
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  const id = Number(match[1]);
                  if (Number.isFinite(id)) {
                    onOpenCard(id);
                  }
                }}
              >
                {children}
              </a>
            );
          }
          return (
            <a {...props} href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        input: ({ node, ...props }: MarkdownInputProps) => {
          if (props.type === 'checkbox') {
            const offset = Number(node?.position?.start?.offset);
            const lineFromNode = Number(node?.position?.start?.line);
            return (
              <input
                type="checkbox"
                checked={Boolean(props.checked)}
                disabled={false}
                readOnly={false}
                onChange={(event) => {
                  event.preventDefault();
                  let taskIndex = -1;
                  if (Number.isFinite(offset)) {
                    taskIndex = findTaskIndexByOffset(preparedSource, offset);
                  } else if (Number.isFinite(lineFromNode)) {
                    taskIndex = taskLineNumbers.findIndex((line) => line === lineFromNode);
                  }
                  onToggleTaskAtIndex(taskIndex);
                }}
              />
            );
          }
          return <input {...props} />;
        },
      }}
    />
  );
}

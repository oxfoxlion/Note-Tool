'use client';

import MDEditor from '@uiw/react-md-editor';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownSanitizeSchema } from '../../../lib/markdownSanitize';

type CardMarkdownPreviewProps = {
  text: string;
  onToggleTaskAtIndex: (index: number) => void;
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

export default function CardMarkdownPreview({ text, onToggleTaskAtIndex }: CardMarkdownPreviewProps) {
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
        input: ({ ...props }: Record<string, unknown>) => {
          if (props.type === 'checkbox') {
            const node = props.node as
              | {
                  position?: {
                    start?: {
                      offset?: number;
                      line?: number;
                    };
                  };
                }
              | undefined;
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

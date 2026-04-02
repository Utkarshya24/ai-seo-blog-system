'use client';

import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlogCopyActionsProps {
  markdown: string;
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function BlogCopyActions({ markdown }: BlogCopyActionsProps) {
  const [copiedType, setCopiedType] = useState<'content' | 'markdown' | null>(null);
  const plainText = useMemo(() => markdownToPlainText(markdown), [markdown]);

  async function handleCopy(type: 'content' | 'markdown') {
    try {
      await copyText(type === 'content' ? plainText : markdown);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 1800);
    } catch (error) {
      console.error('[Blog] Copy failed:', error);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void handleCopy('content')}
      >
        <Copy className="h-4 w-4" />
        {copiedType === 'content' ? 'Copied Content' : 'Copy Content'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void handleCopy('markdown')}
      >
        <Copy className="h-4 w-4" />
        {copiedType === 'markdown' ? 'Copied Markdown' : 'Copy Markdown'}
      </Button>
    </div>
  );
}

'use client';

import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-extrabold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={idx} className="italic text-foreground/90">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export default function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={keyPrefix} className="space-y-1.5 pl-4 list-disc marker:text-indigo-500">
        {listItems.map((item, idx) => (
          <li key={idx} className="text-xs text-foreground/85 leading-relaxed">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(`list-${index}`);
      return;
    }

    // Skip markdown table divider rows
    if (/^\|[\s:-]+\|$/.test(line) || /^\|(\s*-+\s*\|)+$/.test(line)) {
      return;
    }

    // Bullet or numbered list
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      return;
    }

    flushList(`list-${index}`);

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={index} className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 pt-2">
          {renderInline(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ') || line.startsWith('# ')) {
      const text = line.replace(/^#+\s+/, '');
      elements.push(
        <h3 key={index} className="text-sm font-black text-foreground pt-2 border-b border-border/20 pb-1">
          {renderInline(text)}
        </h3>
      );
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={index} className="border-l-2 border-indigo-500 pl-3 py-1 bg-indigo-500/5 rounded-r-xl text-xs italic text-foreground/80">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      return;
    }

    // Table row simplified cleanly
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length > 0) {
        elements.push(
          <div key={index} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-xs">
            <span className="font-semibold text-foreground/75">{renderInline(cells[0])}</span>
            {cells.slice(1).map((c, ci) => (
              <span key={ci} className="font-extrabold text-foreground">{renderInline(c)}</span>
            ))}
          </div>
        );
      }
      return;
    }

    elements.push(
      <p key={index} className="text-xs text-foreground/80 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  });

  flushList('list-end');

  return <div className="space-y-2.5">{elements}</div>;
}

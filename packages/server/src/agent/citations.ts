// ═══════════════════════════════════════════════════════
// CITATION SYSTEM
// Tracks sources used during agent reasoning and attaches
// them to the response for UI rendering
// ═══════════════════════════════════════════════════════

export interface Citation {
  index: number;
  type: 'tool_result' | 'memory' | 'cell_state' | 'conversation' | 'web';
  name: string;
  url?: string;
  snippet?: string;
}

export class CitationTracker {
  private citations: Citation[] = [];
  private counter = 0;

  add(type: Citation['type'], name: string, url?: string, snippet?: string): number {
    this.counter++;
    this.citations.push({
      index: this.counter,
      type,
      name,
      url,
      snippet: snippet?.substring(0, 200),
    });
    return this.counter;
  }

  getCitations(): Citation[] {
    return this.citations;
  }

  toJSON(): Citation[] {
    return this.citations;
  }

  // Format citations as footnotes for LLM context
  toFootnotes(): string {
    if (this.citations.length === 0) return '';
    return '\n\nSources:\n' + this.citations.map(c =>
      `[^${c.index}]: ${c.name}${c.url ? ` (${c.url})` : ''}`
    ).join('\n');
  }
}

// Parse citation markers from agent response text
export function extractCitationMarkers(text: string): number[] {
  const regex = /\[\^(\d+)\]/g;
  const markers: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    markers.push(parseInt(match[1]));
  }
  return [...new Set(markers)];
}

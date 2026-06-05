import type { ASTNode } from '@shared/types';

// Builder functions
export function and(...children: ASTNode[]): ASTNode {
  return { type: 'AND', children };
}

export function or(...children: ASTNode[]): ASTNode {
  return { type: 'OR', children };
}

export function exclude(child: ASTNode): ASTNode {
  return { type: 'EXCLUDE', child };
}

export function literal(value: string, tokenId?: string): ASTNode {
  return { type: 'LITERAL', value, tokenId };
}

export function range(min?: number, max?: number, suffix?: string): ASTNode {
  return { type: 'RANGE', min, max, suffix };
}

// Utility: collect all token IDs from AST
export function collectTokenIds(node: ASTNode): string[] {
  const ids: string[] = [];
  function walk(n: ASTNode) {
    switch (n.type) {
      case 'AND':
      case 'OR':
        n.children.forEach(walk);
        break;
      case 'EXCLUDE':
        walk(n.child);
        break;
      case 'LITERAL':
        if (n.tokenId) ids.push(n.tokenId);
        break;
      case 'RANGE':
        break;
    }
  }
  walk(node);
  return ids;
}

// Utility: flatten AND children (unwrap nested ANDs)
export function flattenAnd(node: ASTNode): ASTNode[] {
  if (node.type === 'AND') {
    return node.children.flatMap(flattenAnd);
  }
  return [node];
}

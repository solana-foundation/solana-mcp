import type { Node } from "web-tree-sitter";

export type WalkCallback = (node: Node) => void | "skip";

export function walk(node: Node, cb: WalkCallback): void {
  const cursor = node.walk();
  const visit = (): void => {
    const current = cursor.currentNode;
    const result = cb(current);
    if (result === "skip") return;
    if (cursor.gotoFirstChild()) {
      do {
        visit();
      } while (cursor.gotoNextSibling());
      cursor.gotoParent();
    }
  };
  visit();
  cursor.delete();
}

export function findAll(root: Node, predicate: (n: Node) => boolean): Node[] {
  const matches: Node[] = [];
  walk(root, n => {
    if (predicate(n)) matches.push(n);
  });
  return matches;
}

export function findFirst(root: Node, predicate: (n: Node) => boolean): Node | null {
  let result: Node | null = null;
  walk(root, n => {
    if (result) return "skip";
    if (predicate(n)) {
      result = n;
      return "skip";
    }
  });
  return result;
}

export function getCallName(fnNode: Node): string | null {
  if (fnNode.type === "identifier") return fnNode.text;
  if (fnNode.type === "scoped_identifier" || fnNode.type === "field_expression") {
    const name = fnNode.childForFieldName("name") ?? fnNode.lastChild;
    return name?.text ?? null;
  }
  return fnNode.lastChild?.text ?? null;
}

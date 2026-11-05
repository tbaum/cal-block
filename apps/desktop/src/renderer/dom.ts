type Child = Node | string | false | undefined;
type Attributes = Record<string, string | number | boolean | ((event: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Attributes = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof value === "function") element.addEventListener(name.replace(/^on/, ""), value);
    else if (typeof value === "boolean") (element as unknown as Record<string, boolean>)[name] = value;
    else element.setAttribute(name, String(value));
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

export function replaceContent(container: Element, ...children: Child[]): void {
  container.replaceChildren(...children.filter((child): child is Node | string => Boolean(child)));
}

export function inputValue(root: ParentNode, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value.trim() ?? "";
}

export function isChecked(root: ParentNode, selector: string): boolean {
  return root.querySelector<HTMLInputElement>(selector)?.checked ?? false;
}

export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

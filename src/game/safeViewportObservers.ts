export const safeViewportTreeObserverOptions = {
  childList: true,
  subtree: true,
} satisfies MutationObserverInit;

export const safeViewportOccluderObserverOptions = {
  attributes: true,
  attributeFilter: ['class', 'style'],
} satisfies MutationObserverInit;

export function safeViewportMutationRootFor(element: Element): Element {
  return (
    element.closest('.game-shell') ?? element.closest('.map-stage') ?? element
  );
}

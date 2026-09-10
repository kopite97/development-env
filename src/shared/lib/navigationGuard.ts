// Dirty forms register independently of the router/provider tree.
const dirtyForms = new Set<symbol>();
export function registerDirtyForm() {
  const id = Symbol();
  dirtyForms.add(id);
  return () => {
    dirtyForms.delete(id);
  };
}
export function confirmNavigation() {
  return dirtyForms.size === 0 || window.confirm('저장하지 않은 변경 사항을 버리고 이동할까요?');
}

let _counter = 0;

export function createPermissionId(): string {
  return `perm_${Date.now()}_${(++_counter).toString(36)}`;
}

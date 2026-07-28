export function createRouteContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

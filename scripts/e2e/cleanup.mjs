// Test helper (task 30): deletes a TEST replication request ("ZZ " customer name) with the service role, even when it has
// approved revisions or customer approvals (the delete guard refuses that for everyone else), and removes its stored PDFs
// and approval files. Falls back to a plain delete when the task-30b SQL has not been run yet.
export async function deleteTestRequest(a, id) {
  if (!id) return;
  for (const dir of [`${id}/revisions`, `${id}/approvals`]) {
    const { data } = await a.storage.from('tech-files').list(dir, { limit: 1000 });
    if (data?.length) await a.storage.from('tech-files').remove(data.map((f) => `${dir}/${f.name}`));
  }
  const r = await a.rpc('delete_test_replication', { p_id: id });
  if (r.error) await a.from('replications').delete().eq('id', id);
}

/** Task 31: removes the catalog change-log rows made by test users or about test items (DEV-only function, task-31b). */
export async function deleteTestCatalogChanges(a) {
  await a.rpc('delete_test_catalog_changes');
}

'use client';

// The request's template in the browser (moved out of ReviewTab.tsx, 2026-11-18, so the request page, the Review tab and the
// AI analysis tab use one lookup). The garment type's template: the family an admin set on the type, else the built-in one.
// Templates come from the database (task 26); the built-in ones are used until they have loaded, or if they cannot be.
// Task 31: at the template versions this tech file was made with, and never quietly a different template: if the templates
// cannot be read and this type needs an admin-made one, `templateProblem` says so (and `template` is the general one).
import { useEffect, useState } from 'react';
import { getGarmentTypes, type GarmentLibraryData } from '@/lib/replicationStorage';
import { resolveTemplate, templateFromList, BUILT_IN_CATALOG, type PinnedVersions, type ResolvedTemplate } from '@/lib/template-catalog';

export function useRequestTemplate(garmentType: string, versions?: PinnedVersions): { template: ResolvedTemplate; templateProblem: string; loaded: boolean } {
  const [list, setList] = useState<Pick<GarmentLibraryData, 'types' | 'templates'> | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { getGarmentTypes().then(l => { setList({ types: l.types, templates: l.templates }); setLoaded(true); }).catch(() => setLoaded(true)); }, [garmentType]);
  let template: ResolvedTemplate;
  let templateProblem = '';
  try { template = templateFromList(garmentType, list, versions); }
  catch (e) { templateProblem = e instanceof Error ? e.message : 'The template could not be read.'; template = resolveTemplate('', null, BUILT_IN_CATALOG); }
  return { template, templateProblem, loaded };
}

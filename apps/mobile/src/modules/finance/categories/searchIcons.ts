import { ICON_CATALOG, type IconCatalogEntry } from './iconCatalog';

/** Minúsculas, sin tildes ni espacios extremos. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Íconos cuyo nombre, palabras clave o nombre técnico contienen la consulta; sin consulta, todo el catálogo. */
export function searchIcons(query: string, catalog: IconCatalogEntry[] = ICON_CATALOG): IconCatalogEntry[] {
  const q = normalizeSearch(query);
  if (!q) return catalog;
  return catalog.filter(
    (entry) => normalizeSearch(entry.label).includes(q) || entry.keywords.some((k) => k.includes(q)) || entry.name.includes(q),
  );
}

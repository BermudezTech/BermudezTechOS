# Contract — Categorías: repositorio, validación, catálogo y paleta (008)

## Repositorio local (`data/local/categoriesRepo.ts`)

```ts
type CategoryFormInput = { name: string; kind: CategoryKind; icon: string; color: string };

createCategory(input: CategoryFormInput): Promise<Category>;
// - valida con categoryInputSchema (modo 'create')
// - rechaza duplicados con new ValidationError('DUPLICATE_NAME', 'name', mensaje)
// - sortOrder = nextSortOrder(kind, activas)
// - store.insert('categories', …) → is_dirty = 1, sync en el siguiente ciclo

updateCategory(id: string, changes: Partial<Pick<CategoryFormInput, 'name' | 'icon' | 'color'>>): Promise<Category>;
// - `kind` nunca se modifica (se ignora si llega)
// - valida con el modo 'edit' (acepta el icon/color almacenado aunque esté fuera del catálogo o la paleta)
// - duplicados excluyendo la propia categoría
// - store.patch('categories', id, …)
```

No hay `deleteCategory` ni archivado (Clarifications 2026-10-31).

Errores con la clase existente `ValidationError` de `FinanceRepository.ts`. Se añade el código `DUPLICATE_NAME` a `ErrorCode` y se reutiliza `NOT_FOUND`. Mensajes en español:

| Código | Campo | Mensaje |
|---|---|---|
| `DUPLICATE_NAME` | `name` | Ya tienes una categoría de {egreso\|ingreso} llamada «{nombre}». |
| `NOT_FOUND` | — | La categoría ya no existe. |

## Esquema (`domain/schemas/category.ts`)

| Campo | Regla | Mensaje |
|---|---|---|
| `name` | `trim`, 1–50 caracteres | "Escribe un nombre" / "Máximo 50 caracteres" |
| `kind` | `INCOME \| EXPENSE` | — |
| `icon` | En el catálogo (create) o en el catálogo / igual al actual (edit) | "Elige un ícono" |
| `color` | En `categoryPalette` (create) o en la paleta / igual al actual (edit) | "Elige un color" |

## Formulario (`CategoryForm`)

Orden de los campos:

1. **Vista previa**: `IconBadge` grande con el ícono y el color, y debajo el nombre (o "Nueva categoría").
2. **Tipo**: `SegmentedControl` Egreso / Ingreso. Solo lectura al editar o cuando llega `fixedKind`.
3. **Nombre**.
4. **Ícono**: botón que muestra el ícono actual y abre `IconPickerSheet`.
5. **Color**: `ColorPalettePicker`.

Botones Guardar y Cancelar. Valores por defecto al crear: ícono `pricetag-outline` y el primer color de la paleta.

## Catálogo de íconos (`categories/iconCatalog.ts`)

```ts
type IconGroupId = 'food' | 'transport' | 'home' | 'utilities' | 'health' | 'education' | 'leisure'
  | 'shopping' | 'finance' | 'work' | 'travel' | 'pets' | 'family' | 'other';
interface IconCatalogEntry { name: IconName; label: string; keywords: string[]; group: IconGroupId }
const ICON_GROUPS: { id: IconGroupId; label: string }[];   // etiquetas en español, en este orden
const ICON_CATALOG: IconCatalogEntry[];                    // ≥ 80 (objetivo ~120)
function searchIcons(query: string): IconCatalogEntry[];
```

Pruebas obligatorias:
- Cada `name` existe en `Ionicons.glyphMap`.
- No hay nombres duplicados.
- Hay al menos 80 entradas y cada grupo tiene al menos 4.
- Están incluidos los 15 íconos de `apps/api/app/modules/categories/defaults.py`.
- `searchIcons` encuentra un resultado para: mercado, gasolina, salario, arriendo, mascota, médico, colegio, regalo, café, bus.
- La búsqueda no distingue tildes ni mayúsculas ("Médico" = "medico").

## Hoja de íconos (`IconPickerSheet`)

- Campo de búsqueda arriba, con autofoco en web.
- Sin búsqueda: secciones por grupo con su título. Con búsqueda: una sola cuadrícula de resultados, o estado vacío.
- Cuadrícula de 5 columnas en móvil y 8 en ancho ≥ 1024. Cada celda mide al menos 44 × 44 y lleva `accessibilityLabel` = `label` y `accessibilityState.selected`.
- Al tocar un ícono se selecciona y se cierra la hoja.

## Paleta (`theme/tokens.ts` + `categories/paletteLabels.ts`)

20 colores. Incluye los 13 actuales, los 5 por defecto del servidor que faltan (`#0EA5E9`, `#22C55E`, `#64748B`, `#D946EF`, `#F59E0B`) y 2 más a elegir en la implementación (p. ej. un rosa pálido y un marrón cálido) que cumplan el piso de contraste de R8. `paletteColorLabels` asigna un nombre en español a cada hex. Pruebas: 20 colores únicos, todos con etiqueta y todos sobre el piso de contraste en claro y oscuro.

## Chip "+ Nueva" (`TransactionForm`)

- Es el último chip de la lista de categorías, con ícono `add` y la etiqueta "Nueva". Aparece solo si `allowCreateCategory` y el tipo no es transferencia.
- Abre `CategoryEditorSheet` con `kind` = tipo actual.
- `onCreated(c)` hace `setValue('categoryId', c.id, { shouldDirty: true })`. El resto del formulario no cambia.

import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { AppText, GlassCard, IconBadge, ListItem, Screen, SectionHeader } from '@/components/ui';
import { safeIconName } from '@/components/ui/iconGlyphs';
import type { CategoryKind } from '@/modules/finance/domain/types';
import { useCategoriesByKind } from '@/modules/finance/hooks/useCategoriesAdmin';
import { useTheme } from '@/theme';

const GROUPS: { kind: CategoryKind; title: string; empty: string }[] = [
  { kind: 'EXPENSE', title: 'Egresos', empty: 'Aún no tienes categorías de egreso.' },
  { kind: 'INCOME', title: 'Ingresos', empty: 'Aún no tienes categorías de ingreso.' },
];

/** Categorías de ingreso y egreso: crear y editar (sin borrar ni archivar, Clarifications 2026-10-31). */
export default function CategoriesScreen() {
  const theme = useTheme();
  const byKind = useCategoriesByKind();
  return (
    <Screen title="Categorías" subtitle="Ingresos y egresos" back>
      {GROUPS.map(({ kind, title, empty }) => (
        <CategoryGroup key={kind} title={title} onNew={() => router.push(`/finance/categories/new?kind=${kind}`)}>
          {byKind[kind].length === 0 ? (
            <AppText tone="muted" style={{ padding: theme.spacing(3) }}>
              {empty}
            </AppText>
          ) : (
            byKind[kind].map((category) => (
              <ListItem
                key={category.id}
                title={category.name}
                left={<IconBadge name={safeIconName(category.icon)} color={category.color ?? undefined} />}
                chevron
                accessibilityLabel={`Editar ${category.name}`}
                onPress={() => router.push(`/finance/categories/${category.id}/edit`)}
              />
            ))
          )}
        </CategoryGroup>
      ))}
    </Screen>
  );
}

function CategoryGroup({ title, onNew, children }: { title: string; onNew: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <>
      <SectionHeader title={title} actionLabel="Nueva" onAction={onNew} />
      <GlassCard padded={false} style={{ padding: theme.spacing(2) }}>
        {children}
      </GlassCard>
    </>
  );
}

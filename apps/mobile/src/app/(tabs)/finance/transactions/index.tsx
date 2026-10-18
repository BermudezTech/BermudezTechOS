import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { SectionList, View } from 'react-native';

import { Amount, AppText, EmptyState, GlassCard, IconButton, Screen, useScreenBottomPadding } from '@/components/ui';
import { DayGroupHeader } from '@/modules/finance/components/transactions/DayGroupHeader';
import { TransactionFilters } from '@/modules/finance/components/transactions/TransactionFilters';
import { TransactionListItem } from '@/modules/finance/components/transactions/TransactionListItem';
import type { TransactionFilter } from '@/modules/finance/data/FinanceRepository';
import type { TransactionType } from '@/modules/finance/domain/types';
import { useAccountMap, useAccountOptions } from '@/modules/finance/hooks/useAccounts';
import { useCategoryMap } from '@/modules/finance/hooks/useFinanceData';
import { useCategories, useTransactions } from '@/modules/finance/hooks/useTransactions';
import { useTheme } from '@/theme';

type Params = { accountId?: string; type?: TransactionType; categoryId?: string; from?: string; to?: string; q?: string };

export default function TransactionsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<Params>();
  const filter: TransactionFilter = useMemo(
    () => ({
      accountId: params.accountId,
      type: params.type,
      categoryId: params.categoryId,
      from: params.from,
      to: params.to,
      search: params.q,
    }),
    [params.accountId, params.type, params.categoryId, params.from, params.to, params.q],
  );
  const { days, total, count } = useTransactions(filter);
  const accounts = useAccountMap();
  const accountOptions = useAccountOptions();
  const categories = useCategories();
  const categoryMap = useCategoryMap();
  const bottomPadding = useScreenBottomPadding();

  const sections = useMemo(() => days.map((d) => ({ key: d.day, day: d.day, net: d.net, data: d.transactions })), [days]);
  const setFilter = useCallback((patch: Partial<TransactionFilter>) => {
    const { search, ...rest } = patch;
    router.setParams({ ...rest, ...('search' in patch ? { q: search } : {}) });
  }, []);
  const clear = useCallback(
    () => router.setParams({ accountId: undefined, type: undefined, categoryId: undefined, from: undefined, to: undefined }),
    [],
  );

  return (
    <Screen
      title="Movimientos"
      back
      scroll={false}
      right={<IconButton icon="add" accessibilityLabel="Nuevo movimiento" onPress={() => router.push('/finance/transactions/new')} />}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: theme.spacing(3) }}>
            <TransactionFilters value={filter} onChange={setFilter} onClear={clear} accounts={accountOptions} categories={categories} />
            <GlassCard>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: theme.spacing(3) }}>
                <Total label="Ingresos" value={<Amount value={total.income} variant="income" />} />
                <Total label="Egresos" value={<Amount value={total.expense} variant="expense" />} />
                <Total label="Balance" value={<Amount value={total.net} />} />
              </View>
              <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(2) }}>
                {count} {count === 1 ? 'movimiento' : 'movimientos'} · sin contar transferencias
              </AppText>
            </GlassCard>
          </View>
        }
        renderSectionHeader={({ section }) => <DayGroupHeader day={section.day} net={section.net} />}
        renderItem={({ item }) => (
          <TransactionListItem tx={item} category={item.categoryId ? categoryMap.get(item.categoryId) : undefined} accounts={accounts} />
        )}
        ListEmptyComponent={
          <View style={{ marginTop: theme.spacing(4) }}>
            <EmptyState
              icon="receipt-outline"
              title={count === 0 && !Object.values(filter).some(Boolean) ? 'Aún no hay movimientos' : 'Sin resultados'}
              message={Object.values(filter).some(Boolean) ? 'Prueba con otros filtros.' : 'Registra tu primer ingreso o egreso.'}
              actionLabel="Nuevo movimiento"
              onAction={() => router.push('/finance/transactions/new')}
            />
          </View>
        }
      />
    </Screen>
  );
}

function Total({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={{ minWidth: 90 }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      {value}
    </View>
  );
}

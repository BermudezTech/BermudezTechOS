import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { cents } from '@/lib/money';
import { ThemeProvider } from '@/theme';

import { useFinanceStore } from '../../data/local/store';
import { putCategory, setupLocalDb } from '../../data/local/testing';
import { makeAccount, makeCategory } from '../../domain/testUtils';
import type { TransactionInput } from '../../domain/types';
import { useActiveCategories } from '../../hooks/useFinanceData';
import { TransactionForm } from './TransactionForm';

const accounts = [
  { account: makeAccount({ id: 'chk', name: 'Corriente', type: 'CHECKING', openingBalance: cents(0) }), label: 'Corriente' },
  { account: makeAccount({ id: 'sav', name: 'Ahorros' }), label: 'Ahorros' },
];
const categories = [
  makeCategory({ id: 'food', name: 'Alimentación', kind: 'EXPENSE' }),
  makeCategory({ id: 'salary', name: 'Salario', kind: 'INCOME' }),
];

async function setup(extra: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
  const onSubmit = jest.fn<Promise<void>, [TransactionInput]>(() => Promise.resolve());
  await render(
    <ThemeProvider>
      <TransactionForm accounts={accounts} categories={categories} onSubmit={onSubmit} {...extra} />
    </ThemeProvider>,
  );
  return { onSubmit };
}

describe('TransactionForm', () => {
  it.each(['0', '-5', '10,555', ''])('muestra error y no guarda con el monto %p', async (amount) => {
    const { onSubmit } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Monto'), amount);
    await fireEvent.press(screen.getByLabelText('Guardar'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('en transferencia oculta la categoría y no ofrece la cuenta origen como destino', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('tab', { name: 'Transferir' }));
    expect(screen.queryByText('Alimentación')).toBeNull();
    await fireEvent.press(screen.getByLabelText(/Cuenta destino/));
    // La lista de destino solo contiene "Ahorros" (la origen por defecto es "Corriente").
    expect(screen.getAllByText('Ahorros').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Corriente')).toHaveLength(1);
  });

  it('guarda un egreso válido con el monto en centavos', async () => {
    const { onSubmit } = await setup();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '25000,50');
    await fireEvent.press(screen.getByRole('radio', { name: 'Alimentación' }));
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0]![0];
    expect(input).toMatchObject({
      type: 'EXPENSE',
      amount: 2_500_050,
      accountId: 'chk',
      categoryId: 'food',
      counterAccountId: null,
      categorySource: 'MANUAL',
    });
  });
});

describe('TransactionForm con grupo de reembolso', () => {
  it('envía el grupo seleccionado por defecto', async () => {
    const { onSubmit } = await setup({ defaults: { reimbursementGroupId: 'g1' }, renderGroupField: () => null });
    await fireEvent.changeText(screen.getByLabelText('Monto'), '50000');
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ reimbursementGroupId: 'g1', amount: 5_000_000, type: 'EXPENSE' });
  });

  it('en transferencias descarta el grupo', async () => {
    const { onSubmit } = await setup({ defaults: { reimbursementGroupId: 'g1', type: 'TRANSFER' }, renderGroupField: () => null });
    await fireEvent.changeText(screen.getByLabelText('Monto'), '1000');
    await fireEvent.press(screen.getByLabelText(/Cuenta destino/));
    await fireEvent.press(screen.getAllByText('Ahorros').at(-1)!);
    await fireEvent.press(screen.getByLabelText('Guardar'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ type: 'TRANSFER', reimbursementGroupId: null, counterAccountId: 'sav' });
  });
});

describe('TransactionForm · crear categoría en línea', () => {
  beforeEach(async () => {
    await setupLocalDb();
    for (const c of categories) putCategory(c);
  });

  /** Como en la app: las categorías llegan del store, así que la nueva aparece al crearla. */
  function StoreBackedForm(props: Omit<React.ComponentProps<typeof TransactionForm>, 'accounts' | 'categories'>) {
    const live = useActiveCategories();
    return <TransactionForm accounts={accounts} categories={live} {...props} />;
  }

  async function setupLive(extra: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
    const onSubmit = jest.fn<Promise<void>, [TransactionInput]>(() => Promise.resolve());
    await render(
      <ThemeProvider>
        <StoreBackedForm onSubmit={onSubmit} allowCreateCategory {...extra} />
      </ThemeProvider>,
    );
    return { onSubmit };
  }

  it('sin la prop no muestra el chip', async () => {
    await setup();
    expect(screen.queryByLabelText('Nueva categoría')).toBeNull();
  });

  it('muestra el chip en egreso e ingreso, no en transferencia', async () => {
    await setupLive();
    expect(screen.getByLabelText('Nueva categoría')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Ingreso' }));
    expect(screen.getByLabelText('Nueva categoría')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Transferir' }));
    expect(screen.queryByLabelText('Nueva categoría')).toBeNull();
  });

  it('crea la categoría, la deja seleccionada y conserva lo escrito', async () => {
    const { onSubmit } = await setupLive();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '80000');
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Mensualidad');
    await fireEvent.press(screen.getByLabelText('Nueva categoría'));
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Gimnasio');
    await fireEvent.press(screen.getByLabelText('Crear'));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Gimnasio', checked: true })).toBeTruthy());
    expect(screen.getByLabelText('Monto').props.value).toBe('80000');
    expect(screen.getByLabelText('Descripción').props.value).toBe('Mensualidad');

    await fireEvent.press(screen.getByLabelText('Guardar'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const created = Object.values(useFinanceStore.getState().categories).find((c) => c.name === 'Gimnasio');
    expect(created).toMatchObject({ kind: 'EXPENSE' });
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ categoryId: created!.id, amount: 8_000_000, description: 'Mensualidad' });
  });

  it('al cancelar no cambia nada', async () => {
    await setupLive();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '1000');
    await fireEvent.press(screen.getByLabelText('Nueva categoría'));
    await fireEvent.press(screen.getByLabelText('Cancelar'));
    expect(screen.getByLabelText('Monto').props.value).toBe('1000');
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(Object.values(useFinanceStore.getState().categories)).toHaveLength(categories.length);
  });
});

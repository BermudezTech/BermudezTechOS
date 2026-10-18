import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { cents } from '@/lib/money';
import { ThemeProvider } from '@/theme';

import { makeAccount, makeCategory } from '../../domain/testUtils';
import type { TransactionInput } from '../../domain/types';
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

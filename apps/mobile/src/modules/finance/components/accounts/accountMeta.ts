import type { IconName } from '@/components/ui';

import type { Account, AccountType } from '../../domain/types';

export const accountTypeMeta: Record<AccountType, { label: string; icon: IconName }> = {
  CHECKING: { label: 'Cuenta corriente', icon: 'card-outline' },
  SAVINGS: { label: 'Cuenta de ahorros', icon: 'wallet-outline' },
  CASH: { label: 'Efectivo', icon: 'cash-outline' },
  CREDIT_CARD: { label: 'Tarjeta de crédito', icon: 'card-outline' },
  POCKET: { label: 'Cajita', icon: 'file-tray-outline' },
  INVESTMENT: { label: 'Inversión', icon: 'trending-up-outline' },
};

export function accountIcon(account: Pick<Account, 'icon' | 'type'>): IconName {
  return (account.icon as IconName | null) ?? accountTypeMeta[account.type].icon;
}

/** Íconos y colores sugeridos en el formulario de cuenta. */
export const accountIconChoices: IconName[] = [
  'wallet-outline',
  'card-outline',
  'cash-outline',
  'business-outline',
  'airplane-outline',
  'shield-checkmark-outline',
  'home-outline',
  'gift-outline',
  'school-outline',
  'people-outline',
];

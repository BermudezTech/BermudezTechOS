import { abbreviateCop, formatCop, negate, type Cents } from '@/lib/money';

import { AppText, type TextVariant } from './AppText';

type Props = {
  value: Cents;
  /**
   * `auto`: color por signo (negativo = egreso). `income`/`expense`: el valor llega positivo
   * y se muestra con "+"/"−". `debt`: valor positivo en color de egreso (deuda).
   */
  variant?: 'auto' | 'default' | 'income' | 'expense' | 'transfer' | 'debt';
  abbreviated?: boolean;
  size?: 'large' | 'normal' | 'small';
  hideZeroCents?: boolean;
  muted?: boolean;
};

const variantBySize: Record<NonNullable<Props['size']>, TextVariant> = {
  large: 'amountLarge',
  normal: 'amount',
  small: 'caption',
};

/** Monto COP. El signo siempre se muestra en texto, no solo con color (FR-038). */
export function Amount({ value, variant = 'auto', abbreviated, size = 'normal', hideZeroCents = true, muted }: Props) {
  const shown = variant === 'expense' ? negate(value) : value;
  const signDisplay = variant === 'income' ? 'always' : 'auto';
  const full = formatCop(shown, { signDisplay });
  const text = abbreviated ? abbreviateCop(shown, { signDisplay }) : formatCop(shown, { hideZeroCents, signDisplay });
  const tone = muted
    ? 'muted'
    : variant === 'income'
      ? 'income'
      : variant === 'expense' || variant === 'debt'
        ? 'expense'
        : variant === 'transfer'
          ? 'transfer'
          : variant === 'auto' && value < 0
            ? 'expense'
            : 'default';
  return (
    <AppText
      variant={variantBySize[size]}
      tone={tone}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      accessibilityLabel={full.replace('\u2212', 'menos ')}
      style={{ fontVariant: ['tabular-nums'] }}>
      {text}
    </AppText>
  );
}

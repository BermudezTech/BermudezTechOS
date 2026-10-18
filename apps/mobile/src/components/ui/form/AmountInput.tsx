import type { TextInputProps } from 'react-native';

import { TextField } from './TextField';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  large?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
};

/** Entrada de monto: entrega el texto crudo, que se convierte con `parseAmount`. */
export function AmountInput({ large = true, ...props }: Props) {
  return (
    <TextField {...props} large={large} prefix="$" keyboardType="decimal-pad" inputMode="decimal" placeholder="0" autoCorrect={false} />
  );
}

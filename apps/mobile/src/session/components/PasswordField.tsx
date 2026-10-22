import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon, TextField } from '@/components/ui';

type Props = Omit<React.ComponentProps<typeof TextField>, 'secureTextEntry' | 'right'>;

/** Campo de contraseña con mostrar/ocultar. */
export function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!visible}
      right={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          hitSlop={8}>
          <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} />
        </Pressable>
      }
    />
  );
}

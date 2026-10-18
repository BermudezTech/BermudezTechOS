import { NotFound, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen title="Página no encontrada" back fallback="/">
      <NotFound message="La ruta que buscas no existe." />
    </Screen>
  );
}

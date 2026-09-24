import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/auth/AuthContext';
import { useLot } from '../../../src/lib/workflow';
import { openTask } from '../../../src/lib/navigation';
import { Button, Note } from '../../../src/ui/form';
import { colors, spacing } from '../../../src/theme';
import DoneView from '../../../src/steps/DoneView';
import GreenStep from '../../../src/steps/GreenStep';
import HarvestStep from '../../../src/steps/HarvestStep';
import LabelStep from '../../../src/steps/LabelStep';
import PackStep from '../../../src/steps/PackStep';
import ReceiveStep from '../../../src/steps/ReceiveStep';
import SendStep from '../../../src/steps/SendStep';
import type { StepDone } from '../../../src/steps/types';

const TITLES: Record<string, string> = {
  harvest: 'Cosecha',
  store_green: 'Bodega verde',
  send_roasting: 'Envío a maquila',
  receive_roast: 'Recepción',
  store_roasted: 'Bodega tostado',
  pack: 'Empaque',
  label: 'Etiquetas',
};

type Params = {
  kind: string; lotId?: string; roastingId?: string; roastedId?: string; roastedStorageId?: string;
};

/** Un paso de la línea, con el lote ya elegido. Al terminar ofrece el siguiente. */
export default function StepRoute() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const { user } = useAuth();
  const [done, setDone] = useState<StepDone | null>(null);
  const lot = useLot(params.kind === 'harvest' ? undefined : params.lotId);
  const role = user?.role;
  const back = () => router.back();
  const toNumber = (v?: string) => (v ? Number(v) : undefined);

  let content: React.ReactNode = null;
  if (done) {
    content = (
      <DoneView
        done={done}
        onNext={(t) => openTask(router, t, 'replace')}
        onOpenLot={(id) => router.replace(`/(app)/lote/${encodeURIComponent(id)}` as never)}
        onHome={() => router.dismissTo('/(app)' as never)}
      />
    );
  } else if (params.kind === 'harvest') {
    content = <HarvestStep role={role} onDone={setDone} onCancel={back} />;
  } else if (!lot.data) {
    content = (
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {lot.isLoading ? <Text style={{ color: colors.muted }}>Cargando el lote…</Text> : (
          <>
            <Note>No hay datos guardados de este lote en el teléfono. Ábralo una vez con señal para poder registrarlo sin cobertura.</Note>
            <Button label="Volver" variant="ghost" onPress={back} />
          </>
        )}
      </View>
    );
  } else {
    const props = { lot: lot.data, role, onDone: setDone, onCancel: back };
    switch (params.kind) {
      case 'store_green': content = <GreenStep {...props} />; break;
      case 'send_roasting': content = <SendStep {...props} />; break;
      case 'receive_roast': content = <ReceiveStep {...props} roastingId={toNumber(params.roastingId)} />; break;
      case 'store_roasted': content = <ReceiveStep {...props} roastedId={toNumber(params.roastedId)} />; break;
      case 'pack': content = <PackStep {...props} roastedStorageId={toNumber(params.roastedStorageId)} />; break;
      case 'label': content = <LabelStep {...props} />; break;
      default: content = <Note>Este paso no existe.</Note>;
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: done ? 'Listo' : TITLES[params.kind] ?? 'Paso' }} />
      {content}
    </>
  );
}

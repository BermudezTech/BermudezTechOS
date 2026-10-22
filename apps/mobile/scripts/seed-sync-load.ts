/**
 * Carga de prueba para medir el primer sync (SC-006). Solo desarrollo: sube a la API, con el usuario
 * indicado, 1 cuenta y 5.000 movimientos repartidos en los últimos 12 meses, en lotes de 500.
 *
 *   LOAD_EMAIL=… LOAD_PASSWORD=… EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1 npx tsx scripts/seed-sync-load.ts
 *
 * Después, en un dispositivo sin datos, inicia sesión con ese usuario y mide la descarga.
 * Los datos quedan en la cuenta: usa un usuario de pruebas.
 */
const TOTAL = 5_000;
const CHUNK = 500;

const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '');
const email = process.env.LOAD_EMAIL;
const password = process.env.LOAD_PASSWORD;

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Centavos → string decimal de la API, sin punto flotante. */
const money = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

async function main() {
  if (!email || !password) throw new Error('Define LOAD_EMAIL y LOAD_PASSWORD.');
  const { accessToken } = await post<{ accessToken: string }>('/auth/login', { email, password });
  const now = new Date();
  const at = now.toISOString();
  const accountId = crypto.randomUUID();
  await post(
    '/sync/push',
    {
      changes: {
        accounts: [
          {
            id: accountId,
            parentAccountId: null,
            name: 'Carga SC-006',
            type: 'SAVINGS',
            nature: 'ASSET',
            currency: 'COP',
            icon: null,
            color: null,
            openingBalance: money(1_000_000_00),
            creditLimit: null,
            statementDay: null,
            paymentDueDay: null,
            isExcludedFromNetWorth: true,
            isArchived: false,
            sortOrder: 999,
            createdAt: at,
            updatedAt: at,
            deletedAt: null,
          },
        ],
      },
    },
    accessToken,
  );

  const yearMs = 365 * 86_400_000;
  const started = Date.now();
  for (let offset = 0; offset < TOTAL; offset += CHUNK) {
    const transactions = Array.from({ length: Math.min(CHUNK, TOTAL - offset) }, (_, i) => {
      const n = offset + i;
      return {
        id: crypto.randomUUID(),
        accountId,
        counterAccountId: null,
        type: n % 10 === 0 ? 'INCOME' : 'EXPENSE',
        amount: money(1_000_00 + ((n * 7919) % 200_000_00)),
        categoryId: null,
        categorySource: 'MANUAL',
        occurredAt: new Date(now.getTime() - Math.floor((n / TOTAL) * yearMs)).toISOString(),
        description: `Carga ${n + 1}`,
        reimbursementGroupId: null,
        subscriptionId: null,
        subscriptionPeriod: null,
        recurringIncomeId: null,
        recurringIncomePeriod: null,
        cdtId: null,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
      };
    });
    const { results } = await post<{ results: { status: string }[] }>('/sync/push', { changes: { transactions } }, accessToken);
    const rejected = results.filter((r) => r.status === 'REJECTED').length;
    console.log(`Lote ${offset / CHUNK + 1}: ${transactions.length} enviados, ${rejected} rechazados`);
  }
  console.log(`Listo: 1 cuenta y ${TOTAL} movimientos en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import { addDays, addMonthsToYearMonth, clampedIsoDate, localDateTimeToUtc, parseIsoDate, type IsoDate } from '@/lib/dates';
import { seededId } from '@/lib/ids';
import { cents, sub, type Cents } from '@/lib/money';

import { expectedNetAtMaturity } from '../../domain/cdtValuation';
import type {
  Account,
  AccountType,
  Asset,
  Category,
  Cdt,
  FinanceData,
  ReimbursementGroup,
  Subscription,
  Transaction,
  TransactionInput,
} from '../../domain/types';

/**
 * Datos de prueba realistas en COP (FR-030), deterministas y relativos a `today` para que
 * siempre haya datos del mes en curso, un CDT próximo a vencer y un bien con valor vencido
 * (research R11). Cumple "Requisitos del seed" de data-model.md.
 */
export type SeedMode = 'full' | 'empty';

/** PRNG determinista (mulberry32). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pesos → centavos. */
const cop = (pesos: number): Cents => cents(Math.round(pesos * 100));

const CATEGORY_DEFS = [
  { key: 'food', name: 'Alimentación', kind: 'EXPENSE', icon: 'restaurant-outline', color: '#F97316' },
  { key: 'transport', name: 'Transporte', kind: 'EXPENSE', icon: 'car-outline', color: '#06B6D4' },
  { key: 'home', name: 'Hogar', kind: 'EXPENSE', icon: 'home-outline', color: '#8B5CF6' },
  { key: 'utilities', name: 'Servicios', kind: 'EXPENSE', icon: 'flash-outline', color: '#EAB308' },
  { key: 'health', name: 'Salud', kind: 'EXPENSE', icon: 'medkit-outline', color: '#10B981' },
  { key: 'education', name: 'Educación', kind: 'EXPENSE', icon: 'school-outline', color: '#3B82F6' },
  { key: 'fun', name: 'Entretenimiento', kind: 'EXPENSE', icon: 'film-outline', color: '#EC4899' },
  { key: 'shopping', name: 'Compras', kind: 'EXPENSE', icon: 'bag-handle-outline', color: '#A855F7' },
  { key: 'subscriptions', name: 'Suscripciones', kind: 'EXPENSE', icon: 'repeat-outline', color: '#6366F1' },
  { key: 'salary', name: 'Salario', kind: 'INCOME', icon: 'briefcase-outline', color: '#22C55E' },
  { key: 'fees', name: 'Honorarios', kind: 'INCOME', icon: 'document-text-outline', color: '#14B8A6' },
  { key: 'yield', name: 'Rendimientos', kind: 'INCOME', icon: 'trending-up-outline', color: '#84CC16' },
  { key: 'otherIncome', name: 'Otros ingresos', kind: 'INCOME', icon: 'cash-outline', color: '#0EA5E9' },
] as const;

type CategoryKey = (typeof CATEGORY_DEFS)[number]['key'];

export function buildSeed(mode: SeedMode, today: IsoDate): FinanceData {
  let counter = 0;
  const nextId = () => seededId(++counter);
  const rng = mulberry32(20261017);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
  /** Monto aleatorio entre min y max pesos, en pasos de `step` pesos. */
  const amount = (min: number, max: number, step = 100): Cents =>
    cop(min + Math.floor(rng() * (Math.floor((max - min) / step) + 1)) * step);

  const { year: ty, month: tm } = parseIsoDate(today);
  const windowStart = (() => {
    const s = addMonthsToYearMonth(ty, tm, -12);
    return clampedIsoDate(s.year, s.month, 1);
  })();
  const baseTs = localDateTimeToUtc(addDays(windowStart, -30), 9);
  const sync = (id: string, at = baseTs) => ({ id, createdAt: at, updatedAt: at, deletedAt: null });

  const data: FinanceData = {
    accounts: {},
    categories: {},
    transactions: {},
    subscriptions: {},
    reimbursementGroups: {},
    cdts: {},
    assets: {},
  };

  // --- Categorías (también en modo vacío: son el set inicial del usuario) ---
  const cat = {} as Record<CategoryKey, string>;
  CATEGORY_DEFS.forEach((def, index) => {
    const category: Category = {
      ...sync(nextId()),
      name: def.name,
      kind: def.kind,
      icon: def.icon,
      color: def.color,
      sortOrder: index,
    };
    data.categories[category.id] = category;
    cat[def.key] = category.id;
  });

  if (mode === 'empty') return data;

  // --- Cuentas ---
  const account = (over: Partial<Account> & { name: string; type: AccountType }): string => {
    const id = nextId();
    data.accounts[id] = {
      ...sync(id),
      parentAccountId: null,
      nature: over.type === 'CREDIT_CARD' ? 'LIABILITY' : 'ASSET',
      currency: 'COP',
      icon: null,
      color: null,
      openingBalance: cents(0),
      creditLimit: null,
      statementDay: null,
      paymentDueDay: null,
      isExcludedFromNetWorth: false,
      isArchived: false,
      sortOrder: Object.keys(data.accounts).length,
      ...over,
    };
    return id;
  };

  const checking = account({
    name: 'Bancolombia Corriente',
    type: 'CHECKING',
    icon: 'card-outline',
    color: '#EAB308',
    openingBalance: cop(1_200_000),
  });
  const savings = account({
    name: 'Bancolombia Ahorros',
    type: 'SAVINGS',
    icon: 'wallet-outline',
    color: '#8B5CF6',
    openingBalance: cop(15_000_000),
  });
  const pocketTrip = account({
    name: 'Cajita Vacaciones',
    type: 'POCKET',
    parentAccountId: savings,
    icon: 'airplane-outline',
    color: '#06B6D4',
  });
  const pocketEmergency = account({
    name: 'Cajita Emergencias',
    type: 'POCKET',
    parentAccountId: savings,
    icon: 'shield-checkmark-outline',
    color: '#10B981',
  });
  const nuSavings = account({
    name: 'Nu Ahorros',
    type: 'SAVINGS',
    icon: 'wallet-outline',
    color: '#A855F7',
    openingBalance: cop(3_500_000),
  });
  const cash = account({ name: 'Efectivo', type: 'CASH', icon: 'cash-outline', color: '#22C55E', openingBalance: cop(300_000) });
  const visa = account({
    name: 'Visa Bancolombia',
    type: 'CREDIT_CARD',
    icon: 'card-outline',
    color: '#3B82F6',
    creditLimit: cop(8_000_000),
    statementDay: 15,
    paymentDueDay: 30,
  });
  const nuCard = account({
    name: 'Tarjeta Nu',
    type: 'CREDIT_CARD',
    icon: 'card-outline',
    color: '#EC4899',
    creditLimit: cop(4_000_000),
    statementDay: 25,
    paymentDueDay: 5,
  });
  account({
    name: 'Cuenta de mamá',
    type: 'SAVINGS',
    icon: 'people-outline',
    color: '#F97316',
    openingBalance: cop(2_000_000),
    isExcludedFromNetWorth: true,
  });
  const closed = account({ name: 'Davivienda (cerrada)', type: 'SAVINGS', icon: 'archive-outline', color: '#6366F1', isArchived: true });

  // --- Transacciones ---
  const add = (
    input: Partial<TransactionInput> & Pick<TransactionInput, 'accountId' | 'type' | 'amount'> & { on: IsoDate; hour?: number },
  ) => {
    const { on, hour, ...rest } = input;
    if (on > today) return null;
    const randomHour = 7 + Math.floor(rng() * 14);
    const minute = Math.floor(rng() * 60);
    // Los movimientos de hoy van temprano para no quedar "en el futuro" respecto a la hora actual.
    const occurredAt = localDateTimeToUtc(on, on === today ? 6 : (hour ?? randomHour), minute);
    const id = nextId();
    const tx: Transaction = {
      ...sync(id, occurredAt),
      counterAccountId: null,
      categoryId: null,
      categorySource: 'MANUAL',
      occurredAt,
      description: null,
      reimbursementGroupId: null,
      subscriptionId: null,
      subscriptionPeriod: null,
      cdtId: null,
      ...rest,
    };
    data.transactions[id] = tx;
    return tx;
  };

  const months = Array.from({ length: 13 }, (_, i) => addMonthsToYearMonth(ty, tm, i - 12));
  const day = (ym: { year: number; month: number }, d: number) => clampedIsoDate(ym.year, ym.month, d);

  const merchants = {
    groceries: ['Éxito', 'Carulla', 'D1', 'Ara', 'Jumbo'],
    restaurants: ['Crepes & Waffles', 'El Corral', 'Juan Valdez', 'Wok', 'Frisby'],
    transport: ['Uber', 'Taxi', 'Gasolina Terpel', 'Peaje', 'TransMilenio', 'DiDi'],
    fun: ['Cine Colombia', 'Concierto', 'Steam', 'Bolera'],
    health: ['Droguería Cruz Verde', 'Cita médica', 'Laboratorio'],
    education: ['Curso en línea', 'Librería Nacional'],
    shopping: ['Falabella', 'Amazon', 'Mercado Libre', 'Zara'],
    utilities: ['EPM Energía y agua', 'Claro Internet', 'Gas Vanti'],
  } as const;

  const cardPurchases = new Map<string, Cents[]>([
    [visa, []],
    [nuCard, []],
  ]);
  const chargeCard = (cardId: string, monthIndex: number, value: Cents) => {
    const list = cardPurchases.get(cardId)!;
    list[monthIndex] = cents((list[monthIndex] ?? 0) + value);
  };

  months.forEach((ym, i) => {
    add({
      accountId: checking,
      type: 'INCOME',
      amount: cop(5_800_000),
      categoryId: cat.salary,
      description: 'Nómina Acme S.A.S.',
      on: day(ym, 1),
      hour: 8,
    });
    add({
      accountId: checking,
      counterAccountId: cash,
      type: 'TRANSFER',
      amount: cop(150_000),
      description: 'Retiro cajero',
      on: day(ym, 1),
      hour: 18,
    });
    add({
      accountId: checking,
      counterAccountId: savings,
      type: 'TRANSFER',
      amount: cop(1_000_000),
      description: 'Ahorro mensual',
      on: day(ym, 2),
    });
    add({
      accountId: savings,
      counterAccountId: pocketTrip,
      type: 'TRANSFER',
      amount: cop(200_000),
      description: 'Apartado vacaciones',
      on: day(ym, 3),
    });
    add({
      accountId: savings,
      counterAccountId: pocketEmergency,
      type: 'TRANSFER',
      amount: cop(150_000),
      description: 'Apartado emergencias',
      on: day(ym, 3),
    });
    add({
      accountId: checking,
      type: 'EXPENSE',
      amount: cop(1_800_000),
      categoryId: cat.home,
      description: 'Arriendo apartamento',
      on: day(ym, 5),
      hour: 10,
    });
    for (const [index, name] of merchants.utilities.entries()) {
      add({
        accountId: checking,
        type: 'EXPENSE',
        amount: amount(60_000, 180_000),
        categoryId: cat.utilities,
        description: name,
        on: day(ym, 9 + index),
      });
    }
    for (let k = 0; k < 4; k++) {
      const value = amount(80_000, 350_000);
      if (
        add({
          accountId: visa,
          type: 'EXPENSE',
          amount: value,
          categoryId: cat.food,
          description: `Mercado ${pick(merchants.groceries)}`,
          on: day(ym, 4 + k * 7),
        })
      )
        chargeCard(visa, i, value);
    }
    for (let k = 0; k < 3; k++) {
      const value = amount(35_000, 150_000);
      if (
        add({
          accountId: nuCard,
          type: 'EXPENSE',
          amount: value,
          categoryId: cat.food,
          description: pick(merchants.restaurants),
          on: day(ym, 6 + k * 8),
          hour: 13 + k * 3,
        })
      )
        chargeCard(nuCard, i, value);
    }
    for (let k = 0; k < 6; k++) {
      const onCard = k % 2 === 0;
      const value = amount(12_000, 60_000);
      const tx = add({
        accountId: onCard ? nuCard : cash,
        type: 'EXPENSE',
        amount: value,
        categoryId: cat.transport,
        description: pick(merchants.transport),
        on: day(ym, 2 + k * 5),
      });
      if (tx && onCard) chargeCard(nuCard, i, value);
    }
    for (let k = 0; k < 2; k++) {
      const value = amount(30_000, 180_000);
      if (
        add({
          accountId: visa,
          type: 'EXPENSE',
          amount: value,
          categoryId: cat.fun,
          description: pick(merchants.fun),
          on: day(ym, 12 + k * 9),
          hour: 20,
        })
      )
        chargeCard(visa, i, value);
    }
    for (let k = 0; k < 2; k++) {
      const value = amount(60_000, 420_000);
      if (
        add({
          accountId: visa,
          type: 'EXPENSE',
          amount: value,
          categoryId: cat.shopping,
          description: pick(merchants.shopping),
          on: day(ym, 15 + k * 6),
        })
      )
        chargeCard(visa, i, value);
    }
    if (i % 2 === 0) {
      add({
        accountId: checking,
        type: 'EXPENSE',
        amount: amount(25_000, 160_000),
        categoryId: cat.health,
        description: pick(merchants.health),
        on: day(ym, 17),
      });
    }
    if (i % 3 === 1) {
      add({
        accountId: checking,
        type: 'EXPENSE',
        amount: amount(90_000, 450_000),
        categoryId: cat.education,
        description: pick(merchants.education),
        on: day(ym, 20),
      });
      add({
        accountId: nuSavings,
        type: 'INCOME',
        amount: cop(1_200_000),
        categoryId: cat.fees,
        description: 'Honorarios consultoría',
        on: day(ym, 22),
      });
    }
  });

  // Cuenta archivada con historia antigua (saldo final 0).
  const old = months[1]!;
  add({
    accountId: closed,
    type: 'INCOME',
    amount: cop(100_000),
    categoryId: cat.otherIncome,
    description: 'Último abono',
    on: day(old, 3),
  });
  add({
    accountId: closed,
    counterAccountId: checking,
    type: 'TRANSFER',
    amount: cop(100_000),
    description: 'Cierre de cuenta',
    on: day(old, 4),
  });

  // --- Suscripciones y sus débitos (subscriptionPeriod YYYY-MM o YYYY) ---
  const subscription = (over: Omit<Subscription, keyof ReturnType<typeof sync>>) => {
    const id = nextId();
    data.subscriptions[id] = { ...sync(id), ...over };
    return id;
  };
  const yearlyMonth = addMonthsToYearMonth(ty, tm, -4);
  const subs = [
    {
      id: subscription({
        accountId: visa,
        categoryId: cat.subscriptions,
        name: 'Netflix',
        icon: 'tv-outline',
        amount: cop(44_900),
        billingCycle: 'MONTHLY',
        billingDay: 31,
        billingMonth: null,
        startDate: windowStart,
        status: 'ACTIVE',
      }),
      until: 0,
    },
    {
      id: subscription({
        accountId: nuCard,
        categoryId: cat.subscriptions,
        name: 'Spotify',
        icon: 'musical-notes-outline',
        amount: cop(16_900),
        billingCycle: 'MONTHLY',
        billingDay: 12,
        billingMonth: null,
        startDate: windowStart,
        status: 'ACTIVE',
      }),
      until: 0,
    },
    {
      id: subscription({
        accountId: checking,
        categoryId: cat.health,
        name: 'Gimnasio Bodytech',
        icon: 'barbell-outline',
        amount: cop(120_000),
        billingCycle: 'MONTHLY',
        billingDay: 5,
        billingMonth: null,
        startDate: windowStart,
        status: 'PAUSED',
      }),
      until: 3,
    },
  ];
  for (const s of subs) {
    const def = data.subscriptions[s.id]!;
    months.forEach((ym, i) => {
      if (i > 12 - s.until) return;
      const period = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      const tx = add({
        accountId: def.accountId,
        type: 'EXPENSE',
        amount: def.amount,
        categoryId: def.categoryId,
        description: def.name,
        subscriptionId: s.id,
        subscriptionPeriod: period,
        on: day(ym, def.billingDay),
        hour: 6,
      });
      if (tx && cardPurchases.has(def.accountId)) chargeCard(def.accountId, i, def.amount);
    });
  }
  const domain = subscription({
    accountId: visa,
    categoryId: cat.subscriptions,
    name: 'Dominio y hosting',
    icon: 'globe-outline',
    amount: cop(119_900),
    billingCycle: 'YEARLY',
    billingDay: 20,
    billingMonth: yearlyMonth.month,
    startDate: clampedIsoDate(ty - 2, yearlyMonth.month, 20),
    status: 'ACTIVE',
  });
  {
    const tx = add({
      accountId: visa,
      type: 'EXPENSE',
      amount: cop(119_900),
      categoryId: cat.subscriptions,
      description: 'Dominio y hosting',
      subscriptionId: domain,
      subscriptionPeriod: String(yearlyMonth.year),
      on: day(yearlyMonth, 20),
      hour: 6,
    });
    if (tx) chargeCard(visa, 8, tx.amount);
  }

  // --- Pagos de tarjeta: transferencia desde la corriente por lo comprado el mes anterior ---
  months.forEach((ym, i) => {
    if (i === 0) return;
    for (const [cardId, payDay] of [
      [visa, 28],
      [nuCard, 5],
    ] as const) {
      const due = cardPurchases.get(cardId)![i - 1];
      if (due)
        add({
          accountId: checking,
          counterAccountId: cardId,
          type: 'TRANSFER',
          amount: due,
          description: 'Pago tarjeta',
          on: day(ym, payDay),
          hour: 9,
        });
    }
  });

  // --- Grupos de reembolso (§5) ---
  const group = (over: Omit<ReimbursementGroup, keyof ReturnType<typeof sync>>) => {
    const id = nextId();
    data.reimbursementGroups[id] = { ...sync(id), ...over };
    return id;
  };
  const trip = group({
    name: 'Viaje Medellín – cliente',
    payer: 'Acme S.A.S.',
    kind: 'REIMBURSEMENT',
    status: 'OPEN',
    notes: 'Legalizar con facturas.',
  });
  add({
    accountId: visa,
    type: 'EXPENSE',
    amount: cop(200_000),
    description: 'Hotel Medellín',
    reimbursementGroupId: trip,
    on: addDays(today, -6),
  });
  add({
    accountId: cash,
    type: 'EXPENSE',
    amount: cop(50_000),
    categoryId: cat.transport,
    description: 'Taxis aeropuerto',
    reimbursementGroupId: trip,
    on: addDays(today, -5),
  });

  const fair = group({ name: 'Feria Corferias', payer: 'Acme S.A.S.', kind: 'ADVANCE', status: 'OPEN', notes: null });
  add({
    accountId: nuSavings,
    type: 'INCOME',
    amount: cop(500_000),
    description: 'Adelanto feria',
    reimbursementGroupId: fair,
    on: addDays(today, -20),
  });
  add({
    accountId: checking,
    type: 'EXPENSE',
    amount: cop(250_000),
    description: 'Stand y material',
    reimbursementGroupId: fair,
    on: addDays(today, -18),
  });
  add({
    accountId: checking,
    type: 'EXPENSE',
    amount: cop(170_000),
    categoryId: cat.food,
    description: 'Almuerzos equipo',
    reimbursementGroupId: fair,
    on: addDays(today, -17),
  });

  const course = group({ name: 'Capacitación Cali', payer: 'Acme S.A.S.', kind: 'REIMBURSEMENT', status: 'SETTLED', notes: null });
  add({
    accountId: nuCard,
    type: 'EXPENSE',
    amount: cop(300_000),
    description: 'Inscripción capacitación',
    reimbursementGroupId: course,
    on: addDays(today, -75),
  });
  add({
    accountId: checking,
    type: 'INCOME',
    amount: cop(300_000),
    description: 'Reembolso capacitación',
    reimbursementGroupId: course,
    on: addDays(today, -50),
  });

  // --- CDTs (§10): cuenta INVESTMENT 1:1 + transferencia de apertura ---
  const cdt = (over: Omit<Cdt, keyof ReturnType<typeof sync> | 'accountId'>, color: string) => {
    const accountId = account({ name: `CDT ${over.issuer}`, type: 'INVESTMENT', icon: 'trending-up-outline', color });
    const id = nextId();
    data.cdts[id] = { ...sync(id), accountId, ...over };
    add({
      accountId: over.sourceAccountId,
      counterAccountId: accountId,
      type: 'TRANSFER',
      amount: over.principal,
      description: `Apertura CDT ${over.issuer}`,
      cdtId: id,
      on: over.openedOn,
      hour: 10,
    });
    return { id, accountId };
  };
  const opened1 = addDays(today, -170);
  cdt(
    {
      issuer: 'Bancolombia',
      certificateNumber: 'CDT-0045821',
      principal: cop(10_000_000),
      annualRateEa: '10.2500',
      annualRateNominal: '9.8000',
      termDays: 180,
      openedOn: opened1,
      maturesOn: addDays(opened1, 180),
      interestPayment: 'AT_MATURITY',
      withholdingRate: '4.00',
      sourceAccountId: savings,
      payoutAccountId: savings,
      status: 'ACTIVE',
      renewedFromCdtId: null,
    },
    '#14B8A6',
  );
  const opened2 = addDays(today, -60);
  cdt(
    {
      issuer: 'Davivienda',
      certificateNumber: null,
      principal: cop(5_000_000),
      annualRateEa: '11.0000',
      annualRateNominal: '10.4800',
      termDays: 360,
      openedOn: opened2,
      maturesOn: addDays(opened2, 360),
      interestPayment: 'AT_MATURITY',
      withholdingRate: '4.00',
      sourceAccountId: nuSavings,
      payoutAccountId: nuSavings,
      status: 'ACTIVE',
      renewedFromCdtId: null,
    },
    '#0EA5E9',
  );
  const opened3 = addDays(today, -400);
  const matured = cdt(
    {
      issuer: 'Banco de Bogotá',
      certificateNumber: 'BB-77120',
      principal: cop(3_000_000),
      annualRateEa: '12.0000',
      annualRateNominal: '11.3900',
      termDays: 90,
      openedOn: opened3,
      maturesOn: addDays(opened3, 90),
      interestPayment: 'AT_MATURITY',
      withholdingRate: '4.00',
      sourceAccountId: nuSavings,
      payoutAccountId: nuSavings,
      status: 'MATURED',
      renewedFromCdtId: null,
    },
    '#84CC16',
  );
  {
    const def = data.cdts[matured.id]!;
    const net = sub(expectedNetAtMaturity(def), def.principal);
    add({
      accountId: matured.accountId,
      counterAccountId: nuSavings,
      type: 'TRANSFER',
      amount: def.principal,
      description: 'Vencimiento CDT (capital)',
      cdtId: matured.id,
      on: def.maturesOn,
      hour: 9,
    });
    add({
      accountId: nuSavings,
      type: 'INCOME',
      amount: net,
      categoryId: cat.yield,
      description: 'Rendimientos CDT (neto)',
      cdtId: matured.id,
      on: def.maturesOn,
      hour: 9,
    });
  }

  // --- Movimientos sin categoría y con categoría sugerida por IA (§6) ---
  add({ accountId: cash, type: 'EXPENSE', amount: cop(23_500), description: 'Pago QR tienda', on: addDays(today, -2), hour: 17 });
  add({ accountId: checking, type: 'EXPENSE', amount: cop(60_000), description: 'Transferencia Nequi', on: addDays(today, -9), hour: 19 });
  const aiCandidates = Object.values(data.transactions)
    .filter(
      (t) =>
        t.type === 'EXPENSE' &&
        !t.reimbursementGroupId &&
        !t.subscriptionId &&
        (t.categoryId === cat.food || t.categoryId === cat.transport),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 3);
  for (const t of aiCandidates) t.categorySource = 'AI';

  // --- Bienes (§7) ---
  const asset = (over: Omit<Asset, keyof ReturnType<typeof sync>>) => {
    const id = nextId();
    data.assets[id] = { ...sync(id), ...over };
  };
  asset({ name: 'Mazda 3 2020', value: cop(72_000_000), validUntil: addDays(today, -30) });
  asset({ name: 'Moto AKT 125', value: cop(6_500_000), validUntil: addDays(today, 200) });

  return data;
}

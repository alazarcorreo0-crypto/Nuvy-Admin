import {
  daysBetweenDates,
  formatDateLong,
  formatWeekRange,
  getWeekRange,
  lastDate
} from '../core/dates.js';
import { money, sum } from '../core/format.js';
import {
  daysOfSupplyRemaining,
  getLastPurchase
} from '../core/inventory.js';
import { emptyState, escapeHtml, notice, pageHeader, statCard } from '../ui/components.js';import { icon } from '../ui/icons.js';

/** Umbrales de las alertas de salud. */
const STALE_COUNT_DAYS = 7;
const LOW_BASE_DAYS = 3;
const STALE_PURCHASE_DAYS = 60;

function renderCashAndProfit(ctx, week) {
  const cut = ctx.store.getWeeklyCut(ctx.today);

  const cashTone = cut.cashFlow.remaining < 0 ? ' is-negative' : '';
  const profitTone = cut.complete && cut.profit < 0 ? ' is-negative' : '';

  return `
    <div class="cut-summary">
      <article class="stat-card cut-profit">
        <div class="stat-top">
          <span class="stat-label">Dinero que te queda esta semana</span>
          <span class="stat-icon">${icon('cash')}</span>
        </div>
        <strong class="stat-value${cashTone}">${money(cut.cashFlow.remaining)}</strong>
        <span class="stat-detail">
          Ventas ${money(cut.cashFlow.salesIn)} − gastos ${money(cut.cashFlow.expensesPaid)}
          − compras ${money(cut.cashFlow.purchasesPaid)}${cut.cashFlow.ownerWithdrawals > 0 ? ` − retiros ${money(cut.cashFlow.ownerWithdrawals)}` : ''}.
          Es el efectivo que de verdad movió la caja (${formatWeekRange(week.start, week.end)}).
        </span>
      </article>

      <article class="stat-card cut-profit">
        <div class="stat-top">
          <span class="stat-label">Ganancia contable de la semana</span>
          <span class="stat-icon">${icon('chart')}</span>
        </div>
        <strong class="stat-value${profitTone}">${cut.complete ? money(cut.profit) : '—'}</strong>
        <span class="stat-detail">
          ${cut.complete
            ? 'Ventas − gastos − costo de lo consumido (vendido + merma).'
            : 'Faltan conteos finales para calcularla.'}
          No es lo mismo que el dinero en caja: las compras pagan inventario que aún tienes y los retiros son tu sueldo, no un gasto.
        </span>
      </article>
    </div>
  `;
}

/**
 * Alertas de salud del negocio: cosas que conviene atender hoy.
 */
function renderHealthAlerts(ctx) {
  const { snapshot, today } = ctx;
  const alerts = [];

  // Sin ventas registradas hoy.
  const hasHistory = snapshot.sales.length > 0;
  const salesToday = snapshot.sales.filter((sale) => sale.date === today);
  if (hasHistory && salesToday.length === 0) {
    alerts.push({
      tone: 'info',
      iconName: 'cash',
      title: 'Todavía no registras ventas de hoy',
      text: 'Al terminar el día registra el total vendido para que el corte de la semana salga completo.',
      action: '<button class="button button-small button-soft" data-go="ventas">Registrar venta</button>'
    });
  }

  // Último conteo físico viejo.
  const lastCountDate = lastDate(snapshot.counts.map((count) => count.date));
  if (lastCountDate) {
    const daysSince = daysBetweenDates(lastCountDate, today);
    if (daysSince > STALE_COUNT_DAYS) {
      alerts.push({
        tone: 'warning',
        iconName: 'clipboard',
        title: `El último conteo fue hace ${daysSince} día${daysSince === 1 ? '' : 's'}`,
        text: 'Sin conteos recientes el inventario estimado y el corte semanal se quedan viejos. Cuenta lo que queda y regístralo.',
        action: '<button class="button button-small button-soft" data-go="inventario">Hacer conteo</button>'
      });
    }
  }

  // Base con pocos días de inventario.
  const lowBase = snapshot.supplies
    .filter((supply) => supply.type === 'base')
    .map((supply) => ({
      supply,
      days: daysOfSupplyRemaining(
        supply,
        snapshot.counts,
        snapshot.purchases,
        today
      )
    }))
    .filter(({ days }) => days !== null && days < LOW_BASE_DAYS);
  if (lowBase.length > 0) {
    const names = lowBase.map(({ supply }) => supply.name).join(', ');
    alerts.push({
      tone: 'danger',
      iconName: 'alert',
      title: `La base alcanza menos de ${LOW_BASE_DAYS} días`,
      text: `Con tu consumo de las últimas 4 semanas, ${names} se acaba pronto. Considera comprar esta semana.`,
      action: '<button class="button button-small button-soft" data-go="compras">Registrar compra</button>'
    });
  }

  // Insumos sin comprar hace más de 60 días (solo si alguna vez se compraron).
  const stale = snapshot.supplies
    .map((supply) => ({
      supply,
      lastPurchase: getLastPurchase(snapshot.purchases, supply.id, today)
    }))
    .filter(
      ({ lastPurchase }) =>
        lastPurchase && daysBetweenDates(lastPurchase.date, today) > STALE_PURCHASE_DAYS
    )
    .sort((a, b) => a.lastPurchase.date.localeCompare(b.lastPurchase.date));
  if (stale.length > 0) {
    const first = stale[0];
    const daysSince = daysBetweenDates(first.lastPurchase.date, today);
    const others = stale.length - 1;
    alerts.push({
      tone: 'info',
      iconName: 'cart',
      title: `${first.supply.name} lleva ${daysSince} días sin comprarse`,
      text: others > 0
        ? `Y hay ${others} insumo${others === 1 ? '' : 's'} más sin compras hace más de ${STALE_PURCHASE_DAYS} días. Revisa si te conviene surtirte.`
        : `Si ya no usas este insumo, no pasa nada; si sí, conviene surtirte.`,
      action: '<button class="button button-small button-soft" data-go="compras">Ver compras</button>'
    });
  }

  if (alerts.length === 0) return '';

  return alerts
    .map((alert) =>
      notice({
        tone: alert.tone,
        iconName: alert.iconName,
        title: alert.title,
        text: alert.text,
        action: alert.action
      })
    )
    .join('');
}

/**
 * Meta del mes: barra de avance de ventas y tope de gastos.
 * Si no hay meta guardada, no se muestra nada.
 */
function renderMonthlyGoal(ctx) {
  const month = ctx.today.slice(0, 7);
  const goal = ctx.store.getGoalFor(month);
  if (!goal) return '';

  const cut = ctx.store.getMonthlyCut(month);
  const salesGoal = Number(goal.salesGoal) || 0;
  const expenseCap = Number(goal.expenseCap) || 0;

  const blocks = [];

  if (salesGoal > 0) {
    const pct = Math.min(100, (cut.totalSales / salesGoal) * 100);
    const missing = Math.max(0, salesGoal - cut.totalSales);
    blocks.push(`
      <div class="progress-block">
        <div class="progress-head">
          <strong>Meta de ventas de ${formatMonthLabel(month)}</strong>
          <span>${money(cut.totalSales)} de ${money(salesGoal)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <p class="progress-foot">
          ${cut.totalSales >= salesGoal
            ? `¡Meta cumplida! Vas ${money(cut.totalSales - salesGoal)} arriba.`
            : `Faltan ${money(missing)} para llegar (${pct.toFixed(0)}%).`}
        </p>
      </div>
    `);
  }

  if (expenseCap > 0) {
    const pct = Math.min(100, (cut.totalExpenses / expenseCap) * 100);
    const over = Math.max(0, cut.totalExpenses - expenseCap);
    blocks.push(`
      <div class="progress-block">
        <div class="progress-head">
          <strong>Tope de gastos de ${formatMonthLabel(month)}</strong>
          <span>${money(cut.totalExpenses)} de ${money(expenseCap)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill${over > 0 ? ' is-over' : ''}" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <p class="progress-foot">
          ${over > 0
            ? `Te pasaste del tope por ${money(over)}.`
            : `Dentro del tope: te quedan ${money(expenseCap - cut.totalExpenses)}.`}
        </p>
      </div>
    `);
  }

  if (blocks.length === 0) return '';

  return `
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Tu meta del mes</h2>
          <p>Cómo va ${formatMonthLabel(month)} contra lo que te propusiste.</p>
        </div>
        <button class="button button-small button-ghost" type="button" data-go="ajustes">Cambiar meta</button>
      </div>
      ${blocks.join('')}
    </section>
  `;
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function render(ctx) {
  const { store, snapshot, today } = ctx;
  const week = getWeekRange(today);
  const salesToday = snapshot.sales.filter((sale) => sale.date === today);
  // Para las tarjetas de gastos se excluyen los retiros del dueño: en el
  // resto de la app no son un gasto del negocio y se muestran por separado.
  const isNotOwner = (expense) => expense.category !== 'owner';
  const expensesToday = snapshot.expenses.filter(
    (expense) => expense.date === today && isNotOwner(expense)
  );
  const salesWeek = snapshot.sales.filter(
    (sale) => sale.date >= week.start && sale.date <= week.end
  );
  const expensesWeek = snapshot.expenses.filter(
    (expense) =>
      expense.date >= week.start && expense.date <= week.end && isNotOwner(expense)
  );
  const lastCountDate = lastDate(snapshot.counts.map((count) => count.date));

  const localNotice = snapshot.status.mode === 'local'
    ? notice({
        tone: 'warning',
        iconName: 'cloudOff',
        title: 'Estás en modo local',
        text: 'Los datos solo están en este dispositivo. Para verlos en otro teléfono, conecta la nube en Ajustes.',
        action: '<button class="button button-small button-soft" data-go="ajustes">Conectar la nube</button>'
      })
    : '';

  const errorNotice = snapshot.status.error
    ? notice({
        tone: 'danger',
        iconName: 'alert',
        title: 'La nube no responde',
        text: snapshot.status.error,
        action: '<button class="button button-small button-soft" data-go="ajustes">Revisar ajustes</button>'
      })
    : '';

  const installNotice = ctx.state.installPrompt
    ? notice({
        tone: 'success',
        iconName: 'install',
        title: 'Instala Nuvy en este teléfono',
        text: 'Así abrirá como aplicación, sin barra de direcciones y con acceso directo.',
        action: '<button class="button button-small button-soft" data-install>Instalar aplicación</button>'
      })
    : '';

  const hasAnyData =
    snapshot.supplies.length ||
    snapshot.sales.length ||
    snapshot.expenses.length ||
    snapshot.purchases.length ||
    snapshot.counts.length;

  return `
    ${pageHeader({
      eyebrow: formatDateLong(today),
      title: 'Resumen de hoy',
      subtitle: `Semana actual: ${formatWeekRange(week.start, week.end)}`
    })}

    ${localNotice}
    ${errorNotice}
    ${installNotice}

    ${renderHealthAlerts(ctx)}

    <div class="stats-grid">
      ${statCard({
        label: 'Ventas de hoy',
        value: money(sum(salesToday.map((sale) => sale.amount))),
        detail: `${salesToday.length} registro${salesToday.length === 1 ? '' : 's'}`,
        tone: 'success',
        iconName: 'cash'
      })}
      ${statCard({
        label: 'Gastos de hoy',
        value: money(sum(expensesToday.map((expense) => expense.amount))),
        detail: `${expensesToday.length} registro${expensesToday.length === 1 ? '' : 's'} · Sin retiros del dueño`,
        tone: 'danger',
        iconName: 'receipt'
      })}
      ${statCard({
        label: 'Ventas de la semana',
        value: money(sum(salesWeek.map((sale) => sale.amount))),
        detail: formatWeekRange(week.start, week.end),
        tone: 'default',
        iconName: 'chart'
      })}
      ${statCard({
        label: 'Gastos de la semana',
        value: money(sum(expensesWeek.map((expense) => expense.amount))),
        detail: 'Sin compras de insumos ni retiros del dueño',
        tone: 'warning',
        iconName: 'receipt'
      })}
    </div>

    ${renderCashAndProfit(ctx, week)}

    ${renderMonthlyGoal(ctx)}

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>¿Qué quieres hacer?</h2>
          <p>Accesos directos a lo más usado.</p>
        </div>
      </div>
      <div class="quick-grid">
        <button class="quick-action" data-go="ventas">
          <span class="quick-icon">${icon('cash')}</span>
          <span class="quick-copy"><strong>Registrar venta</strong><span>Solo fecha y monto total</span></span>
        </button>
        <button class="quick-action quick-berry" data-go="gastos">
          <span class="quick-icon">${icon('receipt')}</span>
          <span class="quick-copy"><strong>Registrar gasto</strong><span>Sueldos, luz, renta…</span></span>
        </button>
        <button class="quick-action quick-amber" data-go="compras">
          <span class="quick-icon">${icon('cart')}</span>
          <span class="quick-copy"><strong>Registrar compra</strong><span>Insumos que entran</span></span>
        </button>
        <button class="quick-action" data-go="inventario">
          <span class="quick-icon">${icon('clipboard')}</span>
          <span class="quick-copy"><strong>Conteo físico</strong><span>Inventario del viernes</span></span>
        </button>
        <button class="quick-action" data-go="corte">
          <span class="quick-icon">${icon('chart')}</span>
          <span class="quick-copy"><strong>Hacer corte</strong><span>Ganancia real de la semana</span></span>
        </button>
        <button class="quick-action" data-go="mensual">
          <span class="quick-icon">${icon('calendar')}</span>
          <span class="quick-copy"><strong>Corte mensual</strong><span>Cómo va el mes</span></span>
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Estado del negocio</h2>
          <p>Lo que el sistema sabe hasta ahora.</p>
        </div>
      </div>
      <div class="card">
        <div class="detail-list">
          <div class="detail-row">
            <dt>Insumos dados de alta</dt>
            <dd>${snapshot.supplies.length}</dd>
          </div>
          <div class="detail-row">
            <dt>Último conteo físico</dt>
            <dd>${lastCountDate ? formatDateLong(lastCountDate) : 'Todavía no hay conteos'}</dd>
          </div>
          <div class="detail-row">
            <dt>Código de familia</dt>
            <dd>${escapeHtml(snapshot.familyCode)}</dd>
          </div>
        </div>
      </div>
    </section>

    ${!hasAnyData ? emptyState({
      iconName: 'sparkles',
      title: 'Empieza por dar de alta tus insumos',
      text: 'Registra la base de nieve y los toppings con su precio de compra. Después podrás registrar compras, ventas y conteos.',
      action: '<button class="button button-primary" data-go="insumos">Dar de alta un insumo</button>'
    }) : ''}
  `;
}

export function bind(root, ctx) {
  root.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => ctx.navigate(button.dataset.go));
  });
  root.querySelector('[data-install]')?.addEventListener('click', () => ctx.installApp());
}

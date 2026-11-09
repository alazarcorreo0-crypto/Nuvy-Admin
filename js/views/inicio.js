import { getWeekRange, formatWeekRange, formatDateLong, lastDate } from '../core/dates.js';
import { money, sum } from '../core/format.js';
import { emptyState, escapeHtml, notice, pageHeader, statCard } from '../ui/components.js';
import { icon } from '../ui/icons.js';

export function render(ctx) {
  const { store, snapshot, today } = ctx;
  const week = getWeekRange(today);
  const salesToday = snapshot.sales.filter((sale) => sale.date === today);
  const expensesToday = snapshot.expenses.filter((expense) => expense.date === today);
  const salesWeek = snapshot.sales.filter(
    (sale) => sale.date >= week.start && sale.date <= week.end
  );
  const expensesWeek = snapshot.expenses.filter(
    (expense) => expense.date >= week.start && expense.date <= week.end
  );
  const lastCountDate = lastDate(snapshot.counts.map((count) => count.date));

  const localNotice = snapshot.status.mode === 'local'
    ? notice({
        tone: 'warning',
        iconName: 'cloudOff',
        title: 'Estás en modo local',
        text: 'Los datos solo están en este dispositivo. Para verlos en el teléfono de tu esposa, conecta la nube en Ajustes.',
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
        detail: `${expensesToday.length} registro${expensesToday.length === 1 ? '' : 's'}`,
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
        detail: 'No incluye compras de insumos',
        tone: 'warning',
        iconName: 'receipt'
      })}
    </div>

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
        <button class="quick-action" data-go="insumos">
          <span class="quick-icon">${icon('box')}</span>
          <span class="quick-copy"><strong>Mis insumos</strong><span>Catálogo y precios</span></span>
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

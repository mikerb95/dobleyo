// Asistente del panel en un navegador real, con el MODELO SIMULADO (US$0).
// La sesión se arma firmando el mismo JWT que emite el login, con el secreto
// de prueba de playwright.asistente.config.js.

import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { createClient } from '@libsql/client';
import { DB_E2E, JWT_E2E } from './entorno.js';

const db = createClient({ url: `file:${DB_E2E}` });
const estadoPedido = async (ref) => (await db.execute({ sql: 'SELECT status FROM customer_orders WHERE reference = ?', args: [ref] })).rows[0].status;

async function entrarComo(context, id, role) {
  const token = jwt.sign({ id, role }, JWT_E2E, { expiresIn: '15m' });
  await context.addCookies([{ name: 'auth_token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

async function preguntar(page, texto) {
  const caja = page.getByRole('textbox', { name: 'Pregunte o busque algo' });
  await expect(caja).toBeEnabled();
  await caja.fill(texto);
  await caja.press('Enter');
}

test.describe('administrador', () => {
  test.beforeEach(async ({ context }) => entrarComo(context, 1, 'admin'));

  test('pregunta, ve los pasos y la respuesta con cifras de la base', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Hola, Admin' })).toBeVisible();
    await preguntar(page, '¿Qué pedidos hay?');
    await expect(page.locator('.asis-paso', { hasText: 'Revisando los pedidos' })).toBeVisible();
    await expect(page.locator('.asis-respuesta').last()).toContainText('$148.000');
    await expect(page).toHaveURL(/\?c=/);

    // Recientes y retomar con ?c=
    const url = page.url();
    await page.goto('/admin');
    await expect(page.locator('#asis-recientes a', { hasText: '¿Qué pedidos hay?' })).toBeVisible();
    await page.goto(url);
    await expect(page.locator('.asis-pregunta', { hasText: '¿Qué pedidos hay?' })).toBeVisible();
    await expect(page.locator('.asis-respuesta').first()).toContainText('$148.000');
  });

  test('propone un cambio, lo aprueba y queda en la base y en la auditoría', async ({ page }) => {
    await page.goto('/admin');
    await preguntar(page, 'Pase el pedido DY-1002 a preparación');
    const tarjeta = page.locator('.asis-tarjeta');
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator('.asis-antes')).toHaveText('Pagado');
    await expect(tarjeta.locator('.asis-despues')).toHaveText('En preparación');
    expect(await estadoPedido('DY-1002')).toBe('paid');

    await tarjeta.getByRole('button', { name: 'Aprobar y guardar' }).click();
    await expect(tarjeta.locator('.asis-tarjeta__sello')).toContainText('Aprobado por usted');
    await expect(page.locator('.asis-respuesta').last()).toContainText('Listo');
    expect(await estadoPedido('DY-1002')).toBe('processing');
    const audit = await db.execute("SELECT decision, ok FROM asistente_auditoria WHERE herramienta = 'cambiar_estado_pedido' AND decision = 'aprobada'");
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  test('descartar no cambia la base', async ({ page }) => {
    await page.goto('/admin');
    await preguntar(page, 'Pase el pedido DY-1001 a preparación');
    const tarjeta = page.locator('.asis-tarjeta');
    await tarjeta.getByRole('button', { name: 'Descartar' }).click();
    await expect(tarjeta.locator('.asis-tarjeta__sello')).toHaveText('Descartado');
    await expect(tarjeta.getByRole('button')).toHaveCount(0);
    expect(await estadoPedido('DY-1001')).toBe('paid');
  });

  test('con el tope agotado la caja solo busca', async ({ page }) => {
    await db.execute('UPDATE asistente_topes SET empresa_usd = 0, usuario_usd = 0 WHERE id = 1');
    try {
      await page.goto('/admin');
      await expect(page.locator('#asis-nota')).toContainText('tope');
      await expect(page.getByRole('button', { name: 'Buscar' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Pregunte o busque algo' }).fill('envíos');
      await expect(page.locator('#asis-resultados a', { hasText: 'Envíos' }).first()).toBeVisible();
    } finally {
      await db.execute('UPDATE asistente_topes SET empresa_usd = 3, usuario_usd = 1 WHERE id = 1');
    }
  });
});

test.describe('caficultor', () => {
  test.beforeEach(async ({ context }) => entrarComo(context, 2, 'caficultor'));

  test('consulta su finca y, si pide un cambio, no aparece tarjeta', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Hola, Rosa' })).toBeVisible();
    await expect(page.locator('#asis-consumo')).toBeHidden();

    await preguntar(page, '¿Cuánto café verde tengo?');
    await expect(page.locator('.asis-paso', { hasText: 'Revisando su finca' })).toBeVisible();
    await expect(page.locator('.asis-respuesta').last()).toContainText('Finca Rosa');

    await preguntar(page, 'Pase el pedido DY-1001 a preparación');
    await expect(page.locator('.asis-turno').last().locator('.asis-respuesta')).toContainText('Sin permiso');
    await expect(page.locator('.asis-tarjeta')).toHaveCount(0);
    expect(await estadoPedido('DY-1001')).toBe('paid');
  });
});

test.afterAll(() => db.close());


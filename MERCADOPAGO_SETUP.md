# Guía de integración MercadoPago — Suscripciones (VendeYaOnline)

Paso a paso para **probar** la integración de suscripciones en modo *sandbox* (con clientes de prueba) y luego **pasarla a producción**.

Aplica a:
- **Backend**: `service-backend-vendeyaonline` (Express, desplegado en Railway).
- **Frontend**: `app-frontend` (Next.js, `www.vendeyaonline.com`).

Modelo usado: **suscripciones sin plan asociado** (se crea un `PreApproval` por usuario).
Moneda: **COP** · País: **Colombia (MCO)**.

---

## 0. Conceptos previos (cómo funciona el flujo)

1. El cliente confirma el plan → el frontend llama a `POST /api/generate_subscription`.
2. El backend crea un `preapproval` en MercadoPago y devuelve el `init_point` (URL de checkout).
3. El cliente paga en MercadoPago y es redirigido al `back_url` con `?preapproval_id=...`.
4. MercadoPago envía **webhooks** a `notification_url`:
   - `subscription_preapproval` (status `authorized`) → activa la suscripción (señal rápida).
   - `subscription_authorized_payment` → respaldo del primer cobro.
   - `payment` → crea el placeholder "en proceso".
5. El frontend hace *polling* hasta que la suscripción aparece activa.

### Variables de entorno relevantes

| Variable | App | Descripción |
|---|---|---|
| `ACCESS_TOKEN` | Backend | Access Token de MercadoPago (**de prueba** o **producción**). |
| `MP_WEBHOOK_SECRET` | Backend | Clave secreta para validar la firma `x-signature` del webhook. |
| `JWT_SECRET` | Backend | Secreto de los JWT de tu app (no es de MP). |
| `DATABASE_URL` | Backend | Conexión a la base de datos. |
| `PORT` | Backend | Puerto del servidor. |
| `NEXT_PUBLIC_URL_BACKEND` | Frontend | URL base del backend que consume el frontend. |

> ⚠️ **Importante:** hoy el `back_url` y el `notification_url` están **hardcodeados** en
> `src/controllers/mercado.controller.ts` (`createSubscription`):
> - `back_url: "https://www.vendeyaonline.com/account"`
> - `notification_url: "https://service-backend-vendeyaonline-production.up.railway.app/api/subscription_notification"`
>
> Para una separación limpia test/producción conviene moverlos a variables de entorno
> (p. ej. `FRONTEND_URL` y `BACKEND_URL`). Ver [Anexo A](#anexo-a-parametrizar-urls-recomendado).

---

# PARTE 1 — MODO PRUEBA (sandbox)

## 1.1 Crear la aplicación en MercadoPago

1. Entra a **https://www.mercadopago.com.co/developers/panel** con tu cuenta.
2. **Tus integraciones → Crear aplicación**.
3. Nombre: `VendeYaOnline` (o el que prefieras).
4. Producto: **Suscripciones / Pagos recurrentes** (CheckoutPro / Suscripciones).
5. Modelo de integración: **Sin plan asociado** (se ajusta a cómo creas el `preapproval`).
6. Guarda. Ya tienes una aplicación con credenciales de **prueba** y de **producción**.

## 1.2 Obtener las credenciales de prueba

1. Dentro de la aplicación → **Credenciales de prueba**.
2. Copia el **Access Token de prueba** (empieza por `TEST-...` o `APP_USR-...` según el panel).
3. Ese token representa al **vendedor de prueba** (quien cobra).

## 1.3 Crear usuarios de prueba

Las suscripciones requieren **dos cuentas de prueba**: una que **cobra** (vendedor) y una que **paga** (comprador).

**Opción A — Panel:** **Cuentas de prueba → Crear cuenta de prueba** (elige país **Colombia**). Crea:
- 1 cuenta **vendedor** (de aquí saldrá el Access Token de prueba que usarás en el backend).
- 1 cuenta **comprador** (con esta inicias sesión para pagar).

**Opción B — API** (con tu Access Token de producción):
```bash
curl -X POST 'https://api.mercadopago.com/users/test_user' \
  -H 'Authorization: Bearer APP_USR-TU_ACCESS_TOKEN_PRODUCCION' \
  -H 'Content-Type: application/json' \
  -d '{"site_id":"MCO"}'
```
Repite el comando para crear el segundo usuario. Guarda `email` y `password` de cada uno.

> El **Access Token de prueba** que pondrás en el backend debe ser el del **vendedor**.

## 1.4 Configurar el backend en modo prueba

En el entorno del backend (Railway → *Variables*, o un `.env` local):

```env
ACCESS_TOKEN=APP_USR-XXXX...   # Access Token DE PRUEBA (vendedor)
MP_WEBHOOK_SECRET=             # se completa en el paso 1.5
JWT_SECRET=tu_secreto_jwt
DATABASE_URL=postgres://...
PORT=5000
```

> Recomendado: usa un **entorno/servicio separado** para pruebas (otra base de datos),
> para no mezclar suscripciones de prueba con las reales.

## 1.5 Configurar los Webhooks de prueba

1. En la aplicación → **Webhooks → Configurar notificaciones**.
2. **Modo:** Pruebas.
3. **URL de producción de eventos** (`notification_url`): la URL pública de tu backend de prueba, p. ej.
   `https://TU-BACKEND-DE-PRUEBA/api/subscription_notification`.
   - Si pruebas en **local**, expón tu backend con un túnel (ngrok/cloudflared) y usa esa URL pública.
4. **Eventos a suscribir** (marca los tres):
   - ✅ **Planes y suscripciones** (`subscription_preapproval`)
   - ✅ **Pagos de suscripciones** (`subscription_authorized_payment`)
   - ✅ **Pagos** (`payment`)
5. Guarda y copia la **Clave secreta** → ponla en `MP_WEBHOOK_SECRET` del backend y **redespliega**.

> Si `MP_WEBHOOK_SECRET` queda vacío, el backend acepta el webhook igual pero deja un
> aviso en logs (`fail-open`). Para una prueba realista, configúralo.

## 1.6 Asegurar que `back_url` y `notification_url` apunten a prueba

- `notification_url` debe ser tu **backend de prueba** (no el de producción).
- `back_url` debe ser tu **frontend de prueba** (p. ej. el preview de Vercel o `localhost:3000/account`).

Si aún están hardcodeados, edítalos temporalmente en `createSubscription` o aplica el [Anexo A](#anexo-a-parametrizar-urls-recomendado).

## 1.7 Configurar el frontend en modo prueba

`.env.local` del frontend:
```env
NEXT_PUBLIC_URL_BACKEND=https://TU-BACKEND-DE-PRUEBA/api
```

## 1.8 Tarjetas de prueba (Colombia)

Usa estas tarjetas estando logueado como el **comprador de prueba**:

| Marca | Número | CVV | Vencimiento |
|---|---|---|---|
| Mastercard | 5031 7557 3453 0604 | 123 | 11/30 |
| Visa | 4509 9535 6623 3704 | 123 | 11/30 |
| American Express | 3711 803032 57522 | 1234 | 11/30 |

**Forzar el resultado** con el *nombre del titular*:

| Nombre titular | Resultado |
|---|---|
| `APRO` | Pago **aprobado** |
| `CONT` | Pendiente |
| `OTHE` | Rechazado (error general) |
| `FUND` | Fondos insuficientes |
| `SECU` | Código de seguridad inválido |
| `EXPI` | Fecha de vencimiento inválida |

Documento de identidad: cualquiera válido (p. ej. tipo `CC`, número `123456789`).

## 1.9 Ejecutar la prueba de punta a punta

1. Inicia sesión en el frontend como un **usuario normal** de tu app.
2. Ve a planes → **Confirmar plan** → te redirige al checkout de MercadoPago.
3. En el checkout, **inicia sesión con la cuenta compradora de prueba**.
4. Paga con una tarjeta de prueba y nombre `APRO`.
5. Verifica la redirección de vuelta a `back_url` con `?preapproval_id=...`.
6. En "Mi Plan" debe verse el loader **"Suscripción en proceso"** y luego, en segundos, el plan **activo**.

## 1.10 Verificaciones

- **Logs del backend:** busca las líneas `[WEBHOOK]` (recepción, `type`, creación de la suscripción).
- **Base de datos:** debe crearse la fila en `subscriptions` y borrarse el placeholder `preapproval_subscription`.
- **Medio de pago:** `GET /api/payment-method/:idUsuario` debe devolver marca y últimos 4 dígitos de la tarjeta de prueba.
- **Firma:** si configuraste `MP_WEBHOOK_SECRET`, un webhook con firma inválida debe responder `401`.

### Checklist de prueba
- [ ] App de MercadoPago creada (Suscripciones, sin plan asociado).
- [ ] Access Token **de prueba** en `ACCESS_TOKEN`.
- [ ] Usuarios de prueba (vendedor + comprador) creados.
- [ ] Webhooks de prueba configurados con los **3 eventos**.
- [ ] `MP_WEBHOOK_SECRET` configurado.
- [ ] `back_url` y `notification_url` apuntan a **prueba**.
- [ ] `NEXT_PUBLIC_URL_BACKEND` apunta al backend de prueba.
- [ ] Pago aprobado (`APRO`) → suscripción activa.
- [ ] Medio de pago visible en "Mi Plan".

---

# PARTE 2 — PASO A PRODUCCIÓN

## 2.1 Activar credenciales de producción

1. En la aplicación → **Credenciales de producción**.
2. Si están bloqueadas, completa los requisitos que pida MercadoPago (datos del negocio,
   homologación/checklist de calidad de la integración).
3. Copia el **Access Token de producción** (`APP_USR-...`).

## 2.2 Configurar variables de entorno de producción (backend)

En Railway (servicio de **producción**):
```env
ACCESS_TOKEN=APP_USR-XXXX...        # Access Token DE PRODUCCIÓN
MP_WEBHOOK_SECRET=XXXX              # clave secreta del webhook de PRODUCCIÓN (paso 2.4)
JWT_SECRET=tu_secreto_jwt
DATABASE_URL=postgres://...         # base de datos de PRODUCCIÓN
PORT=5000
```

## 2.3 Confirmar `back_url` y `notification_url` de producción

- `back_url` → `https://www.vendeyaonline.com/account`
- `notification_url` → `https://service-backend-vendeyaonline-production.up.railway.app/api/subscription_notification`

(Si aplicaste el [Anexo A](#anexo-a-parametrizar-urls-recomendado), basta con setear `FRONTEND_URL` y `BACKEND_URL`.)

## 2.4 Configurar Webhooks de producción

1. Aplicación → **Webhooks**, en **modo Producción**.
2. URL: `https://service-backend-vendeyaonline-production.up.railway.app/api/subscription_notification`.
3. Eventos: **Planes y suscripciones**, **Pagos de suscripciones** y **Pagos** (los mismos tres).
4. Copia la **clave secreta de producción** → `MP_WEBHOOK_SECRET` y **redespliega**.

> La clave secreta de producción es **distinta** a la de prueba.

## 2.5 Frontend de producción

```env
NEXT_PUBLIC_URL_BACKEND=https://service-backend-vendeyaonline-production.up.railway.app/api
```

## 2.6 Prueba final en producción

1. Con una **tarjeta real** y monto bajo, completa una suscripción real.
2. Verifica activación, webhook y medio de pago.
3. Si todo está bien, **cancela/reembolsa** esa suscripción de prueba desde el panel de MercadoPago.

### Checklist de producción
- [ ] Access Token **de producción** en `ACCESS_TOKEN`.
- [ ] `MP_WEBHOOK_SECRET` de **producción** configurado.
- [ ] `DATABASE_URL` de producción.
- [ ] Webhooks de producción con los **3 eventos**.
- [ ] `back_url`/`notification_url` de producción.
- [ ] `NEXT_PUBLIC_URL_BACKEND` apuntando a producción.
- [ ] Prueba real exitosa y reembolsada.

---

## Anexo A — Parametrizar URLs (recomendado)

Hoy las URLs están fijas en el código. Para alternar test/producción sin editar código,
reemplaza en `createSubscription` (`src/controllers/mercado.controller.ts`):

```ts
back_url: `${process.env.FRONTEND_URL}/account`,
notification_url: `${process.env.BACKEND_URL}/api/subscription_notification`,
```

Y define en cada entorno:
```env
# Prueba
FRONTEND_URL=https://preview-tuapp.vercel.app
BACKEND_URL=https://tu-backend-de-prueba

# Producción
FRONTEND_URL=https://www.vendeyaonline.com
BACKEND_URL=https://service-backend-vendeyaonline-production.up.railway.app
```

---

## Anexo B — Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| No llega el webhook | `notification_url` mal configurada o backend no público | Verifica la URL y que el backend sea accesible (túnel en local). |
| Webhook responde `401` | `MP_WEBHOOK_SECRET` no coincide con el del panel | Copia la clave secreta correcta (test vs producción) y redespliega. |
| Tras pagar, "Sin plan activo" un rato | Carrera redirección vs webhook | Es esperado unos segundos; el polling lo resuelve. Revisa logs `[WEBHOOK]`. |
| La suscripción nunca se activa | No se reciben `subscription_preapproval`/`authorized_payment` | Confirma que los 3 eventos están suscritos. |
| "Cannot operate between different countries" | Email/cuenta de otra región | Usa cuentas de prueba **de Colombia (MCO)**. |
| No se ve el medio de pago | No hay pago registrado aún o no es plan `active` | Espera al primer pago; hoy la tarjeta solo se muestra en estado `active`. |

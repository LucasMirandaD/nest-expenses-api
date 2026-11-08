# NestJS Expenses API 🚀

API backend para registro, seguimiento y proyección de gastos financieros personales, con soporte para OCR (Paperless-ngx), orquestación conversacional (Hermes Agent), compras en múltiples cuotas mensuales o aperiódicas (e.g. cada 2 meses), y catálogo de tarjetas titulares y extensiones.

Desarrollada sobre **NestJS 12**, **Node 26 LTS**, **TypeORM 11** y **PostgreSQL 18** (reutilizando la base existente en Proxmox).

---

## Características Principales

- **Clean Architecture & DDD**:
  - `presentation/`: Controladores, DTOs (`class-validator`, `class-transformer`), y Mappers estáticos.
  - `domain/`: Interfaces de entidad, contratos de servicio abstractos (`IExpensesService`), e `InstallmentPlanGenerator` con compensación exacta de centavos.
  - `data/`: Entidades TypeORM (`ExpenseEntity`, `CreditCardEntity`, `ExpenseInstallmentEntity`), contratos abstractos de repositorio (`IExpensesRepository`) e implementaciones de persistencia.
  - `infraestructure/`: Esquema de validación estricto de variables de entorno mediante **Zod** (`env.schema.ts`).
- **Patrón Result (`Result<T, BaseError>`)**:
  - Los servicios nunca lanzan excepciones no controladas.
  - El controlador evalúa `result.isFailure` y mapea los errores canónicos (`NotFound`, `InvalidOperation`, `CouldNotSave`) a `HttpException`.
- **Múltiples Cuotas y Excepciones Temporales**:
  - Cálculo de cuotas fijas o aperiódicas mediante `intervalMonths` (ejemplo: compras que descuentan cada 2 meses).
  - Compensación de redondeo en la primera cuota para evitar pérdida de centavos.
- **Titular vs. Extensiones**:
  - Soporte para tarjetas principales y adicionales (e.g. "Visa Santander de Mamá").
- **Zero-Duplication en Proxmox**:
  - Diseñada para conectarse a la red Docker interna `paperless_default` y a la base `expenses_db` dentro de `paperless-postgres`.
- **Integración Hermes Agent**:
  - Incluye módulo `integrations/hermes/` con la tool en Python (`expenses_tool.py`) y configuración modelo.

---

## Requisitos de Entorno

- **Node.js**: `>= 26.0.0`
- **PostgreSQL**: `>= 17 / 18` con extensión `uuid-ossp`
- **Docker & Docker Compose** (para despliegue en contenedor)

---

## Variables de Entorno (`.env`)

Las variables de entorno son validadas en el arranque con **Zod**:

```env
PORT=3000
NODE_ENV=production

# Base de datos compartida en Proxmox
DB_HOST=paperless-postgres
DB_PORT=5432
DB_USER=expenses_user
DB_PASSWORD=ExpensesSecurePass2026!
DB_NAME=expenses_db
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Paperless-ngx
PAPERLESS_BASE_URL=http://paperless:8000
PAPERLESS_API_TOKEN=your_paperless_token
```

---

## Instalación y Ejecución Local

```bash
# Instalar dependencias
npm install
# o con pnpm
pnpm install

# Compilar proyecto
npm run build

# Ejecutar pruebas unitarias (Jest AAA)
npm test

# Iniciar servidor en modo desarrollo
npm run start:dev
```

---

## Endpoints Principales

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/expenses` | Registrar nuevo gasto (OCR, mensaje chat, SMS o manual) |
| `GET` | `/api/expenses` | Listar últimos gastos registrados con sus cuotas |
| `GET` | `/api/expenses/:id` | Obtener detalle de gasto por ID |
| `GET` | `/api/expenses/installments/summary?month=YYYY-MM` | Resumen consolidado de cuotas a vencer en el mes |
| `GET` | `/api/expenses/cards` | Listar catálogo de tarjetas activas (titulares y adicionales) |
| `POST` | `/api/expenses/cards` | Registrar nueva tarjeta o extensión |
| `GET` | `/api/health` | Healthcheck del servicio |

---

## Ejemplo de Payload para Registro con Cuotas Aperiódicas

`POST /api/expenses`
```json
{
  "merchantName": "Fravega",
  "description": "Smart TV 55 Pulgadas",
  "totalAmount": 300000.00,
  "currency": "ARS",
  "expenseDate": "2026-11-08",
  "paymentMethod": "CREDIT_CARD",
  "cardBank": "Santander",
  "cardName": "Visa Black",
  "cardHolder": "Mamá",
  "isInstallment": true,
  "totalInstallments": 3,
  "intervalMonths": 2,
  "category": "TECNOLOGIA",
  "source": "CHAT_MESSAGE",
  "rawSourceText": "gasté 300k en fravega en 3 cuotas cada 2 meses con la visa santander extensión de mamá"
}
```

---

## Despliegue con Docker

El repositorio incluye un `Dockerfile` multi-stage optimizado sobre `node:26-alpine`:

```bash
docker build -t nest-expenses-api:latest .
```

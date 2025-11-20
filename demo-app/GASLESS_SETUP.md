# Guía de Configuración: Transacciones Gasless (Sponsored Transactions)

Esta guía te ayudará a configurar y usar transacciones gasless en tu aplicación Stellar Social.

## ¿Qué son las Transacciones Gasless?

Las transacciones gasless permiten que un **sponsor** (tú como desarrollador) pague las fees de las transacciones en nombre de tus usuarios, mejorando significativamente la experiencia de usuario.

### Ventajas:
- ✅ Los usuarios no necesitan XLM para realizar transacciones
- ✅ Mejor experiencia de onboarding (no need to fund accounts first)
- ✅ Mayor adopción (sin fricción económica inicial)
- ✅ Control del desarrollador sobre costos

## Configuración Paso a Paso

### 1. Generar Llave del Sponsor (Testnet)

1. Ve a [Stellar Laboratory - Account Creator](https://laboratory.stellar.org/#account-creator)
2. Selecciona **Testnet** (arriba a la derecha)
3. Haz clic en **Generate keypair**
4. **IMPORTANTE**: Guarda la **Secret Key** de forma segura
5. Haz clic en **Get test network lumens** para fondear la cuenta

La cuenta recibirá **10,000 XLM** en testnet automáticamente.

### 2. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Edita `.env.local` y agrega tu **SPONSOR_SECRET_KEY**:

```env
# ⚠️ MANTENER SECRETO - Solo del lado del servidor
SPONSOR_SECRET_KEY=SAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Verificar Implementación

Los siguientes archivos ya están configurados:

- ✅ **API Route**: `src/app/api/sponsor-transaction/route.ts`
- ✅ **SDK Method**: `stellar-social-sdk/src/auth/StellarSocialAccount.ts` (método `sendGaslessPayment`)
- ✅ **UI Toggle**: `src/app/page.tsx` (toggle para activar/desactivar gasless)
- ✅ **Documentación**: `gasslless.tsx` (ejemplos de uso completos)

### 4. Probar la Funcionalidad

1. Inicia el servidor de desarrollo:
```bash
npm run dev
```

2. Abre la aplicación en el navegador
3. Autentícate con Google
4. En la sección "Send XLM Payment":
   - Activa el toggle **⚡ Gasless Mode**
   - Ingresa una dirección de destino
   - Ingresa una cantidad
   - Haz clic en **Send XLM (Gasless)**

5. La transacción será patrocinada por tu cuenta sponsor

## Flujo Técnico

```
Usuario                    API Sponsor                 Blockchain
   |                           |                            |
   |--- Crea TX (fee=0) ------>|                            |
   |                           |                            |
   |                           |--- Crea FeeBumpTx -------->|
   |                           |    (sponsor firma)         |
   |                           |                            |
   |<-- TX Patrocinada --------|                            |
   |                           |                            |
   |--- Usuario firma TX ----->|                            |
   |                           |                            |
   |----------------------- Submit TX -------------------->|
   |                           |                            |
   |<------------------ Confirmación -----------------------|
   |                           |                            |
   |  ✅ Sponsor pagó fees     |    ✅ TX Confirmada        |
```

## Uso del SDK

### Transacción Normal (Usuario paga)
```typescript
const hash = await account.sendPayment(
  'GDESTINATION...',
  '10', // 10 XLM
  undefined,
  'Normal payment'
);
```

### Transacción Gasless (Sponsor paga)
```typescript
const result = await account.sendGaslessPayment(
  'GDESTINATION...',
  '10', // 10 XLM
  '/api/sponsor-transaction',
  undefined,
  'Gasless payment'
);

console.log('Hash:', result.hash);
console.log('Sponsor:', result.sponsorPublicKey);
```

## Seguridad

### ✅ Mejores Prácticas

1. **Nunca expongas SPONSOR_SECRET_KEY en el cliente**
   - Solo debe existir en `.env.local` (servidor)
   - Next.js automáticamente la mantiene server-side

2. **Implementa validaciones** en el API route:
   ```typescript
   // Límite de cantidad
   if (parseFloat(amount) > 100) {
     throw new Error('Máximo 100 XLM por transacción gasless');
   }

   // Rate limiting
   // Whitelist de destinos
   // Verificación de balance del sponsor
   ```

3. **Monitorea el balance del sponsor**
   - Configura alertas cuando el balance sea bajo
   - Ten un proceso para recargar fondos

4. **Logs y auditoría**
   - Registra todas las transacciones patrocinadas
   - Trackea costos totales
   - Identifica patrones de uso anormales

### ⚠️ Qué NO Hacer

- ❌ Commitear `.env.local` a git
- ❌ Exponer SPONSOR_SECRET_KEY en variables `NEXT_PUBLIC_*`
- ❌ Permitir cantidades ilimitadas
- ❌ Patrocinar transacciones sin validación

## Validaciones Opcionales

Puedes agregar validaciones adicionales en `src/app/api/sponsor-transaction/route.ts`:

```typescript
// 1. Límite de cantidad máxima
const MAX_GASLESS_AMOUNT = 100; // XLM
if (parseFloat(amount) > MAX_GASLESS_AMOUNT) {
  return NextResponse.json(
    { error: `Cantidad máxima: ${MAX_GASLESS_AMOUNT} XLM` },
    { status: 400 }
  );
}

// 2. Verificar balance del sponsor
const sponsorBalance = await getSponsorBalance();
if (sponsorBalance < 10) {
  // Alerta: balance bajo
  console.warn('⚠️ Sponsor balance bajo:', sponsorBalance);
}

// 3. Rate limiting por IP
// Implementar con Redis o similar

// 4. Whitelist de destinos
const allowedDestinations = process.env.ALLOWED_DESTINATIONS?.split(',') || [];
if (allowedDestinations.length > 0 && !allowedDestinations.includes(destination)) {
  return NextResponse.json(
    { error: 'Destino no permitido' },
    { status: 403 }
  );
}
```

## Monitoreo

### Métricas Recomendadas

1. **Transacciones patrocinadas**
   - Total de transacciones
   - Transacciones por usuario
   - Transacciones por día/hora

2. **Costos**
   - Fees totales pagadas
   - Promedio de fee por transacción
   - Proyección de costos mensuales

3. **Balance del Sponsor**
   - Balance actual
   - Tasa de consumo
   - Tiempo estimado hasta recarga

### Dashboard de Ejemplo

```typescript
// Endpoint de métricas (opcional)
// GET /api/sponsor-metrics

{
  "totalTransactions": 1234,
  "totalFeesPaid": "12.34 XLM",
  "currentBalance": "9876.54 XLM",
  "averageFeePerTx": "0.01 XLM",
  "last24h": {
    "transactions": 56,
    "feesPaid": "0.56 XLM"
  }
}
```

## Troubleshooting

### Error: "Sponsor secret key no configurada"
- Verifica que `SPONSOR_SECRET_KEY` esté en `.env.local`
- Reinicia el servidor de desarrollo

### Error: "Fondos insuficientes del sponsor"
- El balance del sponsor está bajo
- Recarga fondos usando [Friendbot](https://friendbot.stellar.org) (testnet)
- En mainnet, envía XLM a la cuenta sponsor

### Error: "Error al patrocinar la transacción"
- Verifica que la transacción del usuario sea válida
- Revisa los logs del servidor para más detalles
- Verifica que el formato de la transacción sea correcto

## Migración a Mainnet

Cuando estés listo para producción:

1. **Genera una nueva cuenta sponsor en mainnet**
   - NO uses la misma llave de testnet
   - Usa [Stellar Laboratory](https://laboratory.stellar.org) en modo PUBLIC

2. **Fondea la cuenta sponsor**
   - Envía XLM suficiente para tus necesidades
   - Considera tener al menos 100-1000 XLM para empezar

3. **Actualiza variables de entorno**
   ```env
   NEXT_PUBLIC_STELLAR_NETWORK=mainnet
   SPONSOR_SECRET_KEY=SA_MAINNET_KEY_HERE
   ```

4. **Implementa monitoreo y alertas**
   - Balance bajo
   - Uso anormal
   - Errores frecuentes

5. **Considera límites más estrictos**
   - Menor límite de cantidad por transacción
   - Rate limiting más agresivo
   - Whitelist de usuarios o destinos

## Recursos Adicionales

- 📚 [Stellar Fee-Bump Transactions](https://developers.stellar.org/docs/encyclopedia/fee-bump-transactions)
- 🔧 [Stellar Laboratory](https://laboratory.stellar.org)
- 📖 [Documentación completa en gasslless.tsx](./gasslless.tsx)
- 🌐 [Stellar Expert Explorer](https://stellar.expert/explorer/testnet)

## Soporte

Si encuentras problemas:
1. Revisa la consola del navegador y servidor
2. Verifica la configuración de variables de entorno
3. Consulta `gasslless.tsx` para ejemplos detallados
4. Revisa los logs del API route

---

**¡Listo!** Tu aplicación ahora soporta transacciones gasless patrocinadas por el desarrollador.

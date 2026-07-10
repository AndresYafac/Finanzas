# Análisis de Flujo - Billeteras Virtuales
## FinTrack Pro - Integración de Yape, Plin, Tunki, Mercado Pago, PayPal

**Fecha:** 09/07/2026  
**Objetivo:** Analizar la implementación de billeteras virtuales como entidades financieras vinculadas a bancos  
**Alcance:** Análisis técnico y funcional sin implementación

---

## 1. Contexto Actual

### 1.1 Entidades Bancarias Existentes

El sistema ya contempla billeteras virtuales en el archivo `src/constants/bankLogos.js`:

```javascript
{ keys: ['yape'], label: 'Yape', logo: bankLogo('yape.png'), color: '#742384', accent: '#00c4b3' },
{ keys: ['plin'], label: 'Plin', logo: bankLogo('plin.webp'), color: '#00a3e0', accent: '#7ac943' },
{ keys: ['tunki'], label: 'Tunki', logo: bankLogo('tunki.jpg'), color: '#ff6b00', accent: '#351c75' },
{ keys: ['mercado pago', 'mercadopago'], label: 'MP', color: '#00b1ea', accent: '#ffffff' },
{ keys: ['paypal'], label: 'PayPal', color: '#003087', accent: '#009cde' }
```

**Estado actual:** Las billeteras están definidas como marcas visuales, pero no tienen tratamiento diferenciado en el modelo de datos ni en los flujos de transacción.

### 1.2 Modelo de Datos Actual

#### Tabla `cuentas` (supabase/sql/supabase-schema.sql)
```sql
create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  banco text not null,           -- Nombre del banco/billetera
  tipo text,                     -- Tipo de cuenta
  numero text,                   -- Número de cuenta
  cci text,                      -- CCI (solo bancos)
  moneda text not null default 'PEN',
  saldo numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
```

**Campos relevantes:**
- `banco`: Almacena el nombre (ej: "Yape", "BCP", "Plin")
- `tipo`: Tipo de cuenta (ahorros, corriente, etc.)
- `numero`: Número de cuenta o número de celular (billeteras)
- `cci`: Código interbancario (solo aplica a bancos tradicionales)
- `saldo`: Saldo disponible

#### Tabla `transferencias` (supabase/sql/TRANSFERENCIAS-SCHEMA.sql)
```sql
create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  cuenta_origen_id uuid references public.cuentas(id) on delete set null,
  cuenta_destino_id uuid references public.cuentas(id) on delete set null,
  tipo_destino text not null check (tipo_destino in ('propia', 'externa')),
  banco_destino text,           -- Banco destino
  numero_destino text,          -- Número destino
  titular_destino text,         -- Titular destino
  moneda text not null default 'PEN',
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);
```

#### Tabla `pagos` (supabase/sql/supabase-schema.sql)
```sql
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  deuda_id uuid not null references public.deudas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  cuenta_id uuid references public.cuentas(id) on delete set null,
  monto numeric(14,2) not null check (monto > 0),
  metodo text not null default 'Efectivo',
  referencia text,              -- Número de operación
  fecha date not null,
  notas text,
  created_at timestamptz not null default now()
);
```

### 1.3 Flujos Financieros Existentes

#### Flujo 1: Transferencias entre Cuentas Propias
```
1. Usuario selecciona cuenta origen (ej: BCP)
2. Usuario selecciona cuenta destino (ej: Interbank)
3. Sistema valida saldo suficiente
4. Sistema descuenta de cuenta origen
5. Sistema acredita en cuenta destino
6. Sistema registra transferencia
```

**RPC:** `registrar_transferencia` (TRANSFERENCIAS-SCHEMA.sql)

#### Flujo 2: Transferencias a Cuentas Externas
```
1. Usuario selecciona cuenta origen
2. Usuario ingresa banco destino, número y titular
3. Sistema valida saldo suficiente
4. Sistema descuenta de cuenta origen
5. Sistema registra transferencia externa
```

**RPC:** `registrar_transferencia` con `tipo_destino = 'externa'`

#### Flujo 3: Pagos de Deudas
```
1. Usuario selecciona deuda pendiente
2. Usuario selecciona método de pago (Efectivo, Transferencia, etc.)
3. Usuario selecciona cuenta (si es transferencia)
4. Sistema valida monto no supere saldo pendiente
5. Sistema registra pago
6. Sistema actualiza monto_pagado de la deuda
```

**RPC:** `registrar_pago` (supabase-schema.sql)

#### Flujo 4: Movimientos Financieros
```
1. Usuario registra ingreso o egreso
2. Usuario selecciona cuenta asociada
3. Sistema actualiza saldo de la cuenta
4. Sistema registra movimiento
```

**RPC:** `registar_movimiento_financiero` (MOVIMIENTOS-CUENTAS-SCHEMA.sql)

---

## 2. Análisis de Billeteras Virtuales

### 2.1 Características de las Billeteras Virtuales

| Característica | Yape | Plin | Tunki | Mercado Pago | PayPal |
|----------------|------|------|-------|--------------|--------|
| **Tipo** | Billetera móvil | Billetera móvil | Billetera móvil | Plataforma de pagos | Plataforma internacional |
| **Vinculación** | Cuenta bancaria (BCP, Interbank, etc.) | Cuenta bancaria | Cuenta bancaria (BanBif, etc.) | Cuenta bancaria, tarjeta | Cuenta bancaria, tarjeta |
| **Número identificador** | Celular (9 dígitos) | Celular (9 dígitos) | Celular (9 dígitos) | Celular, email | Email |
| **CCI** | No tiene | No tiene | No tiene | No tiene | No tiene |
| **Saldo** | Saldo de billetera | Saldo de billetera | Saldo de billetera | Saldo de cuenta | Saldo de cuenta |
| **Transferencias a bancos** | Sí (con comisión) | Sí (con comisión) | Sí (con comisión) | Sí | Sí |
| **Transferencias entre billeteras** | Sí (gratis) | Sí (gratis) | Sí (gratis) | Sí | No directo |
| **Pagos en comercios** | Sí (QR) | Sí (QR) | Sí (QR) | Sí | No directo |
| **API pública** | No | No | No | Sí | Sí |

### 2.2 Diferencias Clave vs. Bancos Tradicionales

| Aspecto | Bancos Tradicionales | Billeteras Virtuales |
|---------|---------------------|----------------------|
| **CCI** | Sí (Código Interbancario) | No |
| **Número de cuenta** | Sí (12-20 dígitos) | No (usan celular) |
| **Tipo de cuenta** | Ahorros, Corriente, Plazo fijo | Único (billetera) |
| **Vinculación** | Directa (cuenta propia) | Indirecta (vía banco vinculado) |
| **Comisiones** | Variables | Transferencias entre mismas billeteras: gratis |
| **Horario** | 24/7 (con límites) | 24/7 |
| **Límites** | Por tipo de cuenta | Por nivel de verificación |

### 2.3 Estado Actual en FinTrack Pro

**Lo que funciona hoy:**
- ✅ Las billeteras están definidas en `bankLogos.js`
- ✅ Se pueden crear cuentas de tipo "Yape", "Plin", etc.
- ✅ Se pueden registrar transferencias desde/hacia billeteras
- ✅ Se pueden registrar pagos usando billeteras como método

**Limitaciones actuales:**
- ❌ No hay diferenciación en validaciones (trata Yape como banco tradicional)
- ❌ No hay validación de formato de número (celular vs. cuenta bancaria)
- ❌ No hay validación de CCI (las billeteras no tienen CCI)
- ❌ No hay detección automática de tipo de cuenta (banco vs. billetera)
- ❌ No hay validación de transferencias entre mismas billeteras (gratis)
- ❌ No hay validación de horarios o límites específicos

---

## 3. Propuesta de Implementación

### 3.1 Enfoque: Tratar Billeteras como Cuentas Especiales

**Filosofía:** Las billeteras virtuales son cuentas financieras con reglas específicas, no bancos tradicionales.

**Ventajas:**
- Reutiliza toda la infraestructura existente (tablas, RPCs, RLS)
- No requiere cambios mayores en la arquitectura
- Permite evolucionar gradualmente
- Mantiene consistencia con el modelo actual

### 3.2 Cambios en Modelo de Datos

#### Opción A: Modificar Tabla `cuentas` (Recomendada)

**Cambios mínimos:**

```sql
-- Agregar campo para identificar tipo de entidad
alter table public.cuentas 
  add column if not exists tipo_entidad text not null default 'banco' 
  check (tipo_entidad in ('banco', 'billetera', 'efectivo'));

-- Hacer CCI opcional (solo bancos)
alter table public.cuentas 
  alter column cci drop not null;

-- Agregar validación: billeteras no tienen CCI
alter table public.cuentas 
  add constraint cuentas_cci_valido 
  check (
    (tipo_entidad = 'banco' and cci is not null) or
    (tipo_entidad != 'banco' and cci is null)
  );

-- Agregar índice para filtrar por tipo
create index if not exists cuentas_tipo_entidad_idx 
  on public.cuentas(tipo_entidad);
```

**Ventajas:**
- Cambios mínimos en BD
- No rompe datos existentes
- Fácil de migrar

**Desventajas:**
- Mezcla bancos y billeteras en misma tabla
- Requiere validaciones en aplicación

#### Opción B: Crear Tabla `billeteras` (No Recomendada)

**Cambios mayores:**

```sql
create table public.billeteras (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('yape', 'plin', 'tunki', 'mercadopago', 'paypal')),
  numero text not null,        -- Celular o email
  moneda text not null default 'PEN',
  saldo numeric(14,2) not null default 0,
  cuenta_vinculada_id uuid references public.cuentas(id) on delete set null,
  created_at timestamptz not null default now()
);
```

**Ventajas:**
- Separación clara de conceptos
- Permite agregar campos específicos de billeteras

**Desventajas:**
- Duplicación de lógica (saldo, transacciones)
- Mayor complejidad en RPCs
- Requiere migrar datos existentes
- Rompe consistencia con modelo actual

### 3.3 Cambios en Lógica de Negocio

#### 3.3.1 Detección Automática de Tipo de Entidad

**Función auxiliar en `bankLogos.js`:**

```javascript
export function getBankType(bankName = '') {
  const brand = getBankBrand(bankName);
  if (!brand) return 'banco'; // Por defecto
  
  const billeteras = ['yape', 'plin', 'tunki', 'mercado pago', 'mercadopago', 'paypal'];
  const normalized = normalizeBankName(bankName);
  
  if (billeteras.some(b => normalized.includes(b))) {
    return 'billetera';
  }
  
  return 'banco';
}
```

**Uso en formularios:**
```javascript
// Al crear/editar cuenta
const tipoEntidad = getBankType(bancoSeleccionado);

if (tipoEntidad === 'billetera') {
  // Ocultar campo CCI
  // Validar formato de celular
  // Mostrar mensaje: "Las billeteras no tienen CCI"
} else {
  // Mostrar campo CCI
  // Validar formato de cuenta bancaria
}
```

#### 3.3.2 Validaciones Específicas por Tipo

**Validación de número de cuenta:**

```javascript
export function validarNumeroCuenta(tipoEntidad, numero) {
  if (tipoEntidad === 'billetera') {
    // Validar celular peruano: 9 dígitos, empieza con 9
    const celularRegex = /^9\d{8}$/;
    if (!celularRegex.test(numero.replace(/\s/g, ''))) {
      return { valido: false, mensaje: 'Ingresa un número de celular válido (9 dígitos, empieza con 9)' };
    }
  } else {
    // Validar cuenta bancaria: 12-20 dígitos
    const cuentaRegex = /^\d{12,20}$/;
    if (!cuentaRegex.test(numero.replace(/\s/g, ''))) {
      return { valido: false, mensaje: 'Ingresa un número de cuenta válido (12-20 dígitos)' };
    }
  }
  
  return { valido: true };
}
```

**Validación de CCI:**

```javascript
export function validarCCI(tipoEntidad, cci) {
  if (tipoEntidad === 'billetera') {
    if (cci) {
      return { valido: false, mensaje: 'Las billeteras virtuales no tienen CCI' };
    }
  } else {
    if (!cci) {
      return { valido: false, mensaje: 'El CCI es obligatorio para bancos tradicionales' };
    }
    // Validar formato CCI: 20 dígitos
    const cciRegex = /^\d{20}$/;
    if (!cciRegex.test(cci.replace(/\s/g, ''))) {
      return { valido: false, mensaje: 'El CCI debe tener 20 dígitos' };
    }
  }
  
  return { valido: true };
}
```

#### 3.3.3 Validaciones en Transferencias

**Regla 1: Transferencias entre mismas billeteras (gratis)**

```javascript
export function validarTransferenciaBilleteras(cuentaOrigen, cuentaDestino) {
  const tipoOrigen = getBankType(cuentaOrigen.banco);
  const tipoDestino = getBankType(cuentaDestino.banco);
  
  // Si ambas son billeteras
  if (tipoOrigen === 'billetera' && tipoDestino === 'billetera') {
    const marcaOrigen = getBankBrand(cuentaOrigen.banco);
    const marcaDestino = getBankBrand(cuentaDestino.banco);
    
    // Si son la misma billetera (Yape → Yape)
    if (marcaOrigen?.label === marcaDestino?.label) {
      return {
        valido: true,
        comision: 0,
        mensaje: 'Transferencia gratuita entre cuentas Yape'
      };
    }
  }
  
  return { valido: true, comision: calcularComision(cuentaOrigen, cuentaDestino) };
}
```

**Regla 2: Validación de número destino**

```javascript
export function validarDestinoTransferencia(tipoEntidad, numeroDestino) {
  if (tipoEntidad === 'billetera') {
    // Validar celular
    const celularRegex = /^9\d{8}$/;
    if (!celularRegex.test(numeroDestino.replace(/\s/g, ''))) {
      return { valido: false, mensaje: 'Ingresa un número de celular válido' };
    }
  } else {
    // Validar cuenta bancaria o CCI
    const cuentaRegex = /^\d{12,20}$/;
    const cciRegex = /^\d{20}$/;
    
    if (!cuentaRegex.test(numeroDestino.replace(/\s/g, '')) && 
        !cciRegex.test(numeroDestino.replace(/\s/g, ''))) {
      return { valido: false, mensaje: 'Ingresa un número de cuenta o CCI válido' };
    }
  }
  
  return { valido: true };
}
```

#### 3.3.4 Modificaciones a RPCs Existentes

**RPC `registrar_transferencia` - Modificaciones:**

```sql
create or replace function public.registrar_transferencia(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_tipo_destino text,
  p_banco_destino text,
  p_numero_destino text,
  p_titular_destino text,
  p_monto numeric,
  p_fecha date,
  p_notas text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_origen public.cuentas%rowtype;
  v_destino public.cuentas%rowtype;
  v_transferencia_id uuid;
  v_comision numeric(14,2) := 0;
begin
  if v_admin_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  -- Obtener cuenta origen
  select * into v_origen
  from public.cuentas
  where id = p_cuenta_origen_id and admin_id = v_admin_id
  for update;

  if not found then
    raise exception 'Cuenta origen no encontrada';
  end if;

  -- Validar saldo (incluyendo comisión si aplica)
  if v_origen.saldo < (p_monto + v_comision) then
    raise exception 'Saldo insuficiente en la cuenta origen';
  end if;

  if p_tipo_destino = 'propia' then
    if p_cuenta_destino_id is null or p_cuenta_destino_id = p_cuenta_origen_id then
      raise exception 'Selecciona una cuenta destino diferente';
    end if;

    -- Obtener cuenta destino
    select * into v_destino
    from public.cuentas
    where id = p_cuenta_destino_id and admin_id = v_admin_id
    for update;

    if not found then
      raise exception 'Cuenta destino no encontrada';
    end if;

    -- Validar misma moneda
    if v_destino.moneda <> v_origen.moneda then
      raise exception 'Las cuentas deben tener la misma moneda';
    end if;

    -- NUEVO: Validar transferencia entre billeteras
    if v_origen.tipo_entidad = 'billetera' and v_destino.tipo_entidad = 'billetera' then
      -- Transferencia entre billeteras del mismo tipo (gratis)
      if get_bank_brand(v_origen.banco) = get_bank_brand(v_destino.banco) then
        v_comision := 0;
      else
        -- Transferencia entre billeteras diferentes (con comisión)
        v_comision := calcular_comision_billetera(p_monto);
      end if;
    end if;

    -- Acreditar en cuenta destino
    update public.cuentas
    set saldo = saldo + p_monto
    where id = p_cuenta_destino_id and admin_id = v_admin_id;
    
  elsif p_tipo_destino = 'externa' then
    -- Validar campos obligatorios para destino externo
    if coalesce(trim(p_banco_destino), '') = '' or coalesce(trim(p_numero_destino), '') = '' then
      raise exception 'Completa banco y numero de destino';
    end if;

    -- NUEVO: Validar formato de número destino según tipo de entidad origen
    if v_origen.tipo_entidad = 'billetera' then
      -- Validar que el número destino sea un celular
      if not validar_celular_peruano(p_numero_destino) then
        raise exception 'Las billeteras solo pueden transferir a celulares';
      end if;
    else
      -- Validar que el número destino sea una cuenta bancaria
      if not validar_cuenta_bancaria(p_numero_destino) then
        raise exception 'Ingresa un numero de cuenta valido';
      end if;
    end if;
  else
    raise exception 'Tipo de destino invalido';
  end if;

  -- Descontar monto + comisión de cuenta origen
  update public.cuentas
  set saldo = saldo - (p_monto + v_comision)
  where id = p_cuenta_origen_id and admin_id = v_admin_id;

  -- Registrar comisión como ingreso si aplica
  if v_comision > 0 then
    insert into public.movimientos (
      admin_id, tipo, concepto, categoria, monto, fecha
    ) values (
      v_admin_id, 'ingreso', 
      'Comisión transferencia billetera', 
      'Comisiones', 
      v_comision, 
      coalesce(p_fecha, current_date)
    );
  end if;

  -- Registrar transferencia
  insert into public.transferencias (
    admin_id, cuenta_origen_id, cuenta_destino_id, tipo_destino,
    banco_destino, numero_destino, titular_destino, moneda, monto, fecha, notas
  )
  values (
    v_admin_id, p_cuenta_origen_id,
    case when p_tipo_destino = 'propia' then p_cuenta_destino_id else null end,
    p_tipo_destino,
    p_banco_destino, p_numero_destino, p_titular_destino,
    v_origen.moneda, p_monto, coalesce(p_fecha, current_date), p_notas
  )
  returning id into v_transferencia_id;

  return v_transferencia_id;
end;
$$;
```

**Funciones auxiliares nuevas:**

```sql
-- Función para detectar tipo de entidad
create or replace function public.get_bank_brand(p_banco text)
returns text
language sql
stable
security definer set search_path = public
as $$
  select case
    when lower(p_banco) ~* 'yape' then 'Yape'
    when lower(p_banco) ~* 'plin' then 'Plin'
    when lower(p_banco) ~* 'tunki' then 'Tunki'
    when lower(p_banco) ~* 'mercadopago|mercado pago' then 'Mercado Pago'
    when lower(p_banco) ~* 'paypal' then 'PayPal'
    else 'Banco'
  end;
$$;

-- Función para calcular comisión entre billeteras diferentes
create or replace function public.calcular_comision_billetera(p_monto numeric)
returns numeric
language plpgsql
security definer set search_path = public
as $$
begin
  -- Comisión del 1% con mínimo de S/ 0.50
  return greatest(0.50, p_monto * 0.01);
end;
$$;

-- Función para validar celular peruano
create or replace function public.validar_celular_peruano(p_numero text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  -- Celular peruano: 9 dígitos, empieza con 9
  return p_numero ~* '^9\d{8}$';
end;
$$;

-- Función para validar cuenta bancaria
create or replace function public.validar_cuenta_bancaria(p_numero text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  -- Cuenta bancaria: 12-20 dígitos
  return length(regexp_replace(p_numero, '\s', '', 'g')) between 12 and 20;
end;
$$;
```

### 3.4 Cambios en Frontend

#### 3.4.1 Modificaciones en Formulario de Cuentas

**Campos condicionales:**

```jsx
// Al seleccionar banco/billetera
const handleBancoChange = (banco) => {
  setForm({ ...form, banco });
  
  const tipoEntidad = getBankType(banco);
  setTipoEntidad(tipoEntidad);
  
  // Limpiar CCI si es billetera
  if (tipoEntidad === 'billetera') {
    setForm({ ...form, banco, cci: '' });
  }
  
  // Auto-completar tipo de cuenta
  if (tipoEntidad === 'billetera') {
    setForm({ ...form, banco, tipo: 'Billetera' });
  }
};

// Renderizado condicional
<Form.Field>
  <label>Banco / Billetera</label>
  <Select options={bancosYBilleteras} onChange={handleBancoChange} />
  {tipoEntidad === 'billetera' && (
    <Message info>
      Las billeteras virtuales no tienen CCI. Usa tu número de celular.
    </Message>
  )}
</Form.Field>

<Form.Field>
  <label>Número de Cuenta / Celular</label>
  <Input 
    placeholder={tipoEntidad === 'billetera' ? '9XXXXXXXX' : '123456789012'}
    maxLength={tipoEntidad === 'billetera' ? 9 : 20}
  />
  {tipoEntidad === 'billetera' && (
    <Message info>
      Ingresa tu número de celular de 9 dígitos
    </Message>
  )}
</Form.Field>

<Form.Field>
  <label>CCI</label>
  <Input 
    disabled={tipoEntidad === 'billetera'}
    placeholder={tipoEntidad === 'billetera' ? 'No aplica' : '00012345678901234567'}
  />
  {tipoEntidad === 'billetera' && (
    <Message warning>
      Las billeteras virtuales no tienen CCI
    </Message>
  )}
</Form.Field>
```

#### 3.4.2 Modificaciones en Formulario de Transferencias

```jsx
const handleCuentaOrigenChange = (cuentaId) => {
  const cuenta = cuentas.find(c => c.id === cuentaId);
  setCuentaOrigen(cuenta);
  
  const tipoEntidad = getBankType(cuenta.banco);
  setTipoEntidadOrigen(tipoEntidad);
  
  // Actualizar validaciones
  if (tipoEntidad === 'billetera') {
    setMensajeValidacion('Las billeteras solo pueden transferir a celulares');
  }
};

// Validación de número destino
const validarNumeroDestino = (valor) => {
  if (tipoEntidadOrigen === 'billetera') {
    const celularRegex = /^9\d{8}$/;
    if (!celularRegex.test(valor.replace(/\s/g, ''))) {
      setError('Ingresa un número de celular válido (9 dígitos, empieza con 9)');
      return false;
    }
  } else {
    const cuentaRegex = /^\d{12,20}$/;
    if (!cuentaRegex.test(valor.replace(/\s/g, ''))) {
      setError('Ingresa un número de cuenta válido (12-20 dígitos)');
      return false;
    }
  }
  
  setError(null);
  return true;
};

// Mostrar comisión estimada
const calcularComisionEstimada = () => {
  if (!cuentaOrigen || !cuentaDestino) return 0;
  
  const tipoOrigen = getBankType(cuentaOrigen.banco);
  const tipoDestino = getBankType(cuentaDestino.banco);
  
  if (tipoOrigen === 'billetera' && tipoDestino === 'billetera') {
    const marcaOrigen = getBankBrand(cuentaOrigen.banco);
    const marcaDestino = getBankBrand(cuentaDestino.banco);
    
    if (marcaOrigen?.label === marcaDestino?.label) {
      return 0; // Misma billetera, sin comisión
    } else {
      return Math.max(0.50, monto * 0.01); // Comisión 1% con mínimo S/ 0.50
    }
  }
  
  return 0;
};

// Renderizado
<Message info>
  {tipoEntidadOrigen === 'billetera' 
    ? 'Las billeteras solo pueden transferir a números de celular'
    : 'Puedes transferir a cuentas bancarias o CCI'
  }
</Message>

{calcularComisionEstimada() > 0 && (
  <Message warning>
    Comisión estimada: S/ {calcularComisionEstimada().toFixed(2)}
  </Message>
)}
```

#### 3.4.3 Modificaciones en Formulario de Pagos

```jsx
// Agregar opción de pago con billetera
const metodosPago = [
  { label: 'Efectivo', value: 'Efectivo' },
  { label: 'Transferencia bancaria', value: 'Transferencia' },
  { label: 'Yape', value: 'Yape' },
  { label: 'Plin', value: 'Plin' },
  { label: 'Tunki', value: 'Tunki' },
  { label: 'Mercado Pago', value: 'Mercado Pago' },
  { label: 'PayPal', value: 'PayPal' },
];

// Al seleccionar método de pago
const handleMetodoPagoChange = (metodo) => {
  setForm({ ...form, metodo });
  
  const tipoEntidad = getBankType(metodo);
  
  if (tipoEntidad === 'billetera') {
    // Mostrar selector de cuenta de billetera
    setMostrarSelectorBilletera(true);
    setMostrarSelectorCuentaBancaria(false);
  } else if (metodo === 'Transferencia') {
    setMostrarSelectorBilletera(false);
    setMostrarSelectorCuentaBancaria(true);
  } else {
    setMostrarSelectorBilletera(false);
    setMostrarSelectorCuentaBancaria(false);
  }
};

// Renderizado
<Form.Field>
  <label>Método de Pago</label>
  <Select options={metodosPago} onChange={handleMetodoPagoChange} />
</Form.Field>

{mostrarSelectorBilletera && (
  <Form.Field>
    <label>Cuenta de Billetera</label>
    <Select 
      options={cuentasBilleteras} // Filtrar solo billeteras del tipo seleccionado
    />
    <Message info>
      Se descontará el monto del saldo de tu billetera
    </Message>
  </Form.Field>
)}

{mostrarSelectorCuentaBancaria && (
  <Form.Field>
    <label>Cuenta Bancaria</label>
    <Select options={cuentasBancarias} />
  </Form.Field>
)}
```

### 3.5 Cambios en Servicios Frontend

#### 3.5.1 Modificaciones en `src/services/cuentas.service.js`

```javascript
// Nueva función para filtrar cuentas por tipo
export function filtrarCuentasPorTipo(cuentas, tipoEntidad) {
  return cuentas.filter(cuenta => {
    const tipo = getBankType(cuenta.banco);
    return tipo === tipoEntidad;
  });
}

// Nueva función para obtener solo billeteras
export function getBilleteras(cuentas) {
  return filtrarCuentasPorTipo(cuentas, 'billetera');
}

// Nueva función para obtener solo bancos
export function getBancos(cuentas) {
  return filtrarCuentasPorTipo(cuentas, 'banco');
}

// Modificar función de validación de transferencia
export function validarTransferencia(cuentaOrigen, cuentaDestino, monto) {
  const errores = [];
  
  // Validar saldo
  if (cuentaOrigen.saldo < monto) {
    errores.push('Saldo insuficiente en la cuenta origen');
  }
  
  // Validar misma moneda
  if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
    errores.push('Las cuentas deben tener la misma moneda');
  }
  
  // NUEVO: Validar transferencia entre billeteras
  const tipoOrigen = getBankType(cuentaOrigen.banco);
  const tipoDestino = getBankType(cuentaDestino.banco);
  
  if (tipoOrigen === 'billetera' && tipoDestino === 'billetera') {
    const marcaOrigen = getBankBrand(cuentaOrigen.banco);
    const marcaDestino = getBankBrand(cuentaDestino.banco);
    
    if (marcaOrigen?.label !== marcaDestino?.label) {
      const comision = Math.max(0.50, monto * 0.01);
      if (cuentaOrigen.saldo < (monto + comision)) {
        errores.push(`Saldo insuficiente. Se requiere S/ ${(monto + comision).toFixed(2)} (incluye comisión de S/ ${comision.toFixed(2)})`);
      }
    }
  }
  
  return errores;
}
```

#### 3.5.2 Modificaciones en `src/services/pagos.service.js`

```javascript
// Nueva función para filtrar métodos de pago por tipo
export function getMetodosPagoPorTipo(tipoEntidad) {
  if (tipoEntidad === 'billetera') {
    return ['Yape', 'Plin', 'Tunki', 'Mercado Pago', 'PayPal'];
  }
  
  return ['Efectivo', 'Transferencia', 'Cheque'];
}

// Modificar función de registro de pago
export function registrarPagoConValidacion(supabase, payload) {
  const { metodo, cuenta_id, monto } = payload;
  
  // Si el método es una billetera, validar que la cuenta sea de ese tipo
  if (getBankType(metodo) === 'billetera') {
    const cuenta = cuentas.find(c => c.id === cuenta_id);
    if (!cuenta || getBankType(cuenta.banco) !== 'billetera') {
      return { 
        error: true, 
        mensaje: 'Selecciona una cuenta de billetera válida' 
      };
    }
  }
  
  return registrarPago(supabase, payload);
}
```

---

## 4. Flujos de Transacción Específicos

### 4.1 Flujo: Transferencia Yape → Yape (Gratis)

```
1. Usuario tiene dos cuentas Yape:
   - Yape Personal (S/ 100.00)
   - Yape Negocio (S/ 50.00)

2. Usuario quiere transferir S/ 30.00 de Personal a Negocio

3. Sistema detecta:
   - tipo_entidad origen = 'billetera'
   - tipo_entidad destino = 'billetera'
   - marca_origen = 'Yape'
   - marca_destino = 'Yape'
   - Comisión = S/ 0.00

4. Validaciones:
   - Saldo origen (S/ 100.00) >= S/ 30.00 + S/ 0.00 ✓
   - Misma moneda ✓

5. Ejecución:
   - Descontar S/ 30.00 de Yape Personal → S/ 70.00
   - Acreditar S/ 30.00 en Yape Negocio → S/ 80.00
   - Registrar transferencia sin comisión

6. Resultado:
   - Transferencia registrada
   - Sin comisión
   - Sin movimiento adicional
```

### 4.2 Flujo: Transferencia Yape → Plin (Con Comisión)

```
1. Usuario tiene:
   - Yape (S/ 100.00)
   - Plin (S/ 50.00)

2. Usuario quiere transferir S/ 30.00 de Yape a Plin

3. Sistema detecta:
   - tipo_entidad origen = 'billetera' (Yape)
   - tipo_entidad destino = 'billetera' (Plin)
   - marca_origen = 'Yape'
   - marca_destino = 'Plin'
   - Comisión = S/ 0.50 (1% de S/ 30.00 = S/ 0.30, mínimo S/ 0.50)

4. Validaciones:
   - Saldo origen (S/ 100.00) >= S/ 30.00 + S/ 0.50 ✓
   - Misma moneda ✓

5. Ejecución:
   - Descontar S/ 30.50 de Yape → S/ 69.50
   - Acreditar S/ 30.00 en Plin → S/ 80.00
   - Registrar comisión como ingreso:
     * Movimiento: "Comisión transferencia billetera"
     * Monto: S/ 0.50
     * Categoría: "Comisiones"
   - Registrar transferencia

6. Resultado:
   - Transferencia registrada
   - Comisión de S/ 0.50 cobrada
   - Movimiento de comisión registrado
```

### 4.3 Flujo: Transferencia Yape → BCP (Banca tradicional)

```
1. Usuario tiene:
   - Yape (S/ 100.00)
   - BCP (S/ 500.00)

2. Usuario quiere transferir S/ 50.00 de Yape a BCP

3. Sistema detecta:
   - tipo_entidad origen = 'billetera' (Yape)
   - tipo_entidad destino = 'banco' (BCP)
   - Comisión = S/ 0.00 (no definida aún, puede ser 0 o variable)

4. Validaciones:
   - Saldo origen (S/ 100.00) >= S/ 50.00 ✓
   - Misma moneda ✓
   - Número destino debe ser cuenta bancaria (12-20 dígitos)

5. Ejecución:
   - Descontar S/ 50.00 de Yape → S/ 50.00
   - Acreditar S/ 50.00 en BCP → S/ 550.00
   - Registrar transferencia externa

6. Resultado:
   - Transferencia registrada
   - Sin comisión (por ahora)
```

### 4.4 Flujo: Pago de Deuda con Yape

```
1. Usuario tiene:
   - Deuda: "Venta #123" - S/ 200.00 pendiente
   - Yape: S/ 300.00

2. Usuario quiere pagar S/ 100.00 de la deuda usando Yape

3. Sistema detecta:
   - Método de pago: "Yape"
   - Cuenta: Yape (tipo_entidad = 'billetera')

4. Validaciones:
   - Monto (S/ 100.00) <= Saldo pendiente (S/ 200.00) ✓
   - Saldo Yape (S/ 300.00) >= S/ 100.00 ✓

5. Ejecución:
   - Registrar pago:
     * Deuda: "Venta #123"
     * Monto: S/ 100.00
     * Método: "Yape"
     * Cuenta: Yape
   - Actualizar deuda:
     * monto_pagado: S/ 100.00 → S/ 100.00
     * saldo_pendiente: S/ 200.00 → S/ 100.00
   - Descontar de Yape: S/ 300.00 → S/ 200.00

6. Resultado:
   - Pago registrado
   - Deuda actualizada
   - Saldo de Yape actualizado
```

### 4.5 Flujo: Recarga de Yape desde BCP

```
1. Usuario tiene:
   - BCP: S/ 1,000.00
   - Yape: S/ 100.00

2. Usuario quiere recargar S/ 200.00 a Yape desde BCP

3. Sistema detecta:
   - Cuenta origen: BCP (banco)
   - Cuenta destino: Yape (billetera)
   - Comisión: S/ 0.00 (transferencia banco → billetera)

4. Validaciones:
   - Saldo BCP (S/ 1,000.00) >= S/ 200.00 ✓
   - Misma moneda ✓

5. Ejecución:
   - Descontar S/ 200.00 de BCP → S/ 800.00
   - Acreditar S/ 200.00 en Yape → S/ 300.00
   - Registrar transferencia propia

6. Resultado:
   - Transferencia registrada
   - Saldos actualizados
```

---

## 5. Consideraciones de Seguridad

### 5.1 Validaciones en Base de Datos

**Todas las validaciones se ejecutan en RPCs con `SECURITY DEFINER`:**

- ✅ Validación de autenticación (`auth.uid()`)
- ✅ Validación de propiedad (`admin_id`)
- ✅ Validación de saldo suficiente
- ✅ Validación de tipo de entidad
- ✅ Validación de formato de número
- ✅ Validación de comisiones

**RLS existente:**
- ✅ Admin puede gestionar todas sus cuentas
- ✅ Clientes pueden ver sus propias deudas y pagos
- ✅ No hay acceso cruzado entre admins

### 5.2 Validaciones en Frontend

**Todas las validaciones se ejecutan ANTES de llamar al RPC:**

- ✅ Validación de formato de celular (billeteras)
- ✅ Validación de formato de cuenta bancaria
- ✅ Validación de CCI (solo bancos)
- ✅ Validación de saldo suficiente
- ✅ Validación de comisión
- ✅ Validación de misma moneda

**Beneficio:** Mejor UX con feedback inmediato, sin esperar respuesta del servidor.

### 5.3 Auditoría

**Registros existentes:**
- ✅ Tabla `transferencias` con todos los detalles
- ✅ Tabla `pagos` con método y referencia
- ✅ Tabla `movimientos` con categoría y concepto

**Mejoras propuestas:**
- Agregar campo `tipo_entidad_origen` en `transferencias`
- Agregar campo `tipo_entidad_destino` en `transferencias`
- Agregar campo `comision` en `transferencias`
- Registrar comisiones como movimientos de categoría "Comisiones"

### 5.4 Prevención de Fraude

**Validaciones automáticas:**
- Límite diario de transferencias entre billeteras diferentes
- Límite de monto por transferencia (configurable)
- Detección de patrones sospechosos (muchas transferencias en poco tiempo)
- Bloqueo de transferencias a cuentas propias (mismo número)

**Alertas:**
- Notificar transferencias de alto monto (> S/ 1,000)
- Notificar transferencias entre billeteras diferentes
- Notificar comisiones generadas

---

## 6. Impacto en Funcionalidades Existentes

### 6.1 Funcionalidades sin Cambios

✅ **Dashboard** - No requiere cambios, muestra saldos de todas las cuentas  
✅ **Reportes** - No requiere cambios, incluye todas las transacciones  
✅ **Clientes** - No requiere cambios  
✅ **Deudas** - No requiere cambios  
✅ **Préstamos** - No requiere cambios  
✅ **Presupuestos** - No requiere cambios  
✅ **Metas** - No requiere cambios  
✅ **Backup** - No requiere cambios  
✅ **Auditoría** - No requiere cambios  

### 6.2 Funcionalidades con Cambios Menores

⚠️ **Gestión de Cuentas** - Agregar detección automática de tipo de entidad  
⚠️ **Transferencias** - Agregar validaciones específicas y cálculo de comisiones  
⚠️ **Pagos** - Agregar métodos de pago de billeteras  
⚠️ **Movimientos** - Mostrar comisiones como movimientos separados  

### 6.3 Funcionalidades Nuevas

🆕 **Validación de formato de número** - Según tipo de entidad  
🆕 **Cálculo de comisiones** - Automático entre billeteras diferentes  
🆕 **Registro de comisiones** - Como movimientos de categoría "Comisiones"  
🆕 **Filtros por tipo de entidad** - Filtrar cuentas por banco/billetera/efectivo  

---

## 7. Plan de Implementación Recomendado

### Fase 1: Cambios en Base de Datos (1 día)

1. **Agregar campo `tipo_entidad` en tabla `cuentas`**
   - Migrar datos existentes (detectar tipo por nombre de banco)
   - Agregar constraint de validación
   - Agregar índice

2. **Crear funciones auxiliares en PostgreSQL**
   - `get_bank_brand()` - Detectar marca de billetera
   - `calcular_comision_billetera()` - Calcular comisión
   - `validar_celular_peruano()` - Validar celular
   - `validar_cuenta_bancaria()` - Validar cuenta bancaria

3. **Modificar RPC `registrar_transferencia`**
   - Agregar validación de tipo de entidad
   - Agregar cálculo de comisiones
   - Agregar registro de comisiones como movimientos

### Fase 2: Cambios en Servicios Frontend (2 días)

1. **Modificar `src/constants/bankLogos.js`**
   - Agregar función `getBankType()`
   - Agregar función `validarNumeroCuenta()`
   - Agregar función `validarCCI()`

2. **Modificar `src/services/cuentas.service.js`**
   - Agregar función `filtrarCuentasPorTipo()`
   - Agregar función `getBilleteras()`
   - Agregar función `getBancos()`
   - Modificar función `validarTransferencia()`

3. **Modificar `src/services/pagos.service.js`**
   - Agregar función `getMetodosPagoPorTipo()`
   - Modificar función `registrarPagoConValidacion()`

### Fase 3: Cambios en Componentes Frontend (3 días)

1. **Modificar formulario de cuentas**
   - Agregar detección automática de tipo de entidad
   - Mostrar/ocultar campos condicionalmente (CCI)
   - Validar formato de número según tipo
   - Mostrar mensajes informativos

2. **Modificar formulario de transferencias**
   - Validar número destino según tipo de entidad origen
   - Calcular y mostrar comisión estimada
   - Mostrar mensaje de comisión si aplica
   - Validar saldo incluyendo comisión

3. **Modificar formulario de pagos**
   - Agregar métodos de pago de billeteras
   - Filtrar cuentas según método de pago seleccionado
   - Mostrar selector de billetera si aplica

### Fase 4: Pruebas y Ajustes (2 días)

1. **Pruebas unitarias**
   - Validar detección de tipo de entidad
   - Validar formatos de número
   - Validar cálculo de comisiones
   - Validar RPCs con billeteras

2. **Pruebas de integración**
   - Transferencia Yape → Yape (gratis)
   - Transferencia Yape → Plin (con comisión)
   - Transferencia Yape → BCP (sin comisión)
   - Pago de deuda con Yape
   - Recarga de Yape desde BCP

3. **Pruebas de UX**
   - Validar mensajes informativos
   - Validar validaciones en tiempo real
   - Validar flujos completos

### Fase 5: Documentación y Capacitación (1 día)

1. **Documentación técnica**
   - Actualizar documentación de base de datos
   - Actualizar documentación de servicios
   - Documentar nuevas validaciones

2. **Documentación de usuario**
   - Manual de uso de billeteras
   - Preguntas frecuentes (FAQ)
   - Guía de transferencias entre billeteras

---

## 8. Beneficios de la Implementación

### 8.1 Beneficios Técnicos

✅ **Reutilización de infraestructura** - No requiere cambios mayores en arquitectura  
✅ **Validaciones centralizadas** - En BD y frontend  
✅ **Escalabilidad** - Fácil agregar nuevas billeteras  
✅ **Mantenibilidad** - Código limpio y modular  
✅ **Performance** - Sin impacto en rendimiento  

### 8.2 Beneficios de Negocio

✅ **Experiencia de usuario mejorada** - Validaciones claras y mensajes informativos  
✅ **Reducción de errores** - Validaciones automáticas previenen errores  
✅ **Transparencia** - Comisiones visibles antes de confirmar  
✅ **Competitividad** - Funcionalidades que ofrece la competencia  
✅ **Diferenciación** - Transferencias entre billeteras gratis (misma marca)  

### 8.3 Beneficios Financieros

✅ **Registro de comisiones** - Nueva fuente de ingresos  
✅ **Trazabilidad completa** - Todas las transacciones registradas  
✅ **Reportes de comisiones** - Análisis de rentabilidad  
✅ **Control de límites** - Prevenir fraudes y errores  

---

## 9. Riesgos y Mitigaciones

### 9.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Errores en validaciones** | Media | Alto | Pruebas exhaustivas en RPCs y frontend |
| **Inconsistencia de datos** | Baja | Alto | Migración controlada con validaciones |
| **Performance en RPCs** | Baja | Medio | Índices en tablas, queries optimizadas |
| **Compatibilidad con datos existentes** | Media | Alto | Migración gradual con rollback |

### 9.2 Riesgos de Negocio

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Confusión de usuarios** | Media | Medio | Mensajes claros y tooltips |
| **Errores en transferencias** | Media | Alto | Validaciones dobles (frontend + backend) |
| **Comisiones no deseadas** | Baja | Alto | Mostrar comisión antes de confirmar |
| **Fraude en billeteras** | Baja | Alto | Límites y alertas automáticas |

### 9.3 Riesgos de Cumplimiento

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Incumplimiento de términos de uso** | Media | Alto | Revisar términos de Yape, Plin, etc. |
| **Protección de datos** | Baja | Alto | No almacenar datos sensibles de billeteras |
| **Lavado de dinero** | Baja | Crítico | Límites y reportes de actividad sospechosa |

---

## 10. Consideraciones Legales

### 10.1 Términos de Uso de Billeteras

**Yape (BCP):**
- Uso personal y comercial permitido
- Prohibido uso para actividades ilegales
- Límites de transferencia según nivel de verificación

**Plin (Interbank, BBVA, Scotiabank, BanBif):**
- Uso personal y comercial permitido
- Transferencias gratuitas entre usuarios Plin
- Límites variables según banco

**Tunki (BanBif):**
- Uso personal y comercial permitido
- Transferencias gratuitas entre usuarios Tunki
- Límites según nivel de verificación

**Mercado Pago:**
- Uso comercial permitido
- API pública disponible
- Comisiones por retiro a cuenta bancaria

**PayPal:**
- Uso comercial permitido
- API pública disponible
- Comisiones por recepción de pagos

### 10.2 Recomendaciones Legales

1. **Términos y condiciones** - Incluir cláusula de uso de billeteras virtuales
2. **Política de privacidad** - Especificar que no se almacenan credenciales de billeteras
3. **Descargo de responsabilidad** - Aclarar que FinTrack Pro no es responsable de fallos en billeteras
4. **Cumplimiento tributario** - Registrar todas las transacciones para SUNAT

---

## 11. Próximos Pasos

### Inmediatos (1 semana)
1. Presentar este análisis al equipo
2. Obtener aprobación de enfoque (Opción A: modificar tabla `cuentas`)
3. Crear rama de desarrollo: `feature/billeteras-virtuales`
4. Ejecutar Fase 1 (cambios en BD)

### Corto plazo (2-3 semanas)
1. Completar Fases 2 y 3 (servicios y componentes)
2. Pruebas unitarias y de integración
3. Pruebas de UX con usuarios beta

### Mediano plazo (1 mes)
1. Completar Fase 4 (pruebas)
2. Documentación técnica y de usuario
3. Capacitación a usuarios
4. Release a producción

### Largo plazo (3 meses)
1. Monitoreo de uso y errores
2. Ajustes según feedback
3. Agregar nuevas billeteras según demanda
4. Integración con APIs oficiales (Mercado Pago, PayPal)

---

## 12. Conclusiones

### 12.1 Viabilidad

✅ **Alta viabilidad técnica** - Cambios mínimos en arquitectura existente  
✅ **Alta viabilidad de negocio** - Funcionalidades demandadas por usuarios  
✅ **Bajo riesgo** - Validaciones dobles y migración controlada  

### 12.2 Recomendación

**Implementar billeteras virtuales como cuentas especiales** (Opción A) por las siguientes razones:

1. **Menor impacto** - No requiere cambios mayores en arquitectura
2. **Reutilización** - Aprovecha toda la infraestructura existente
3. **Flexibilidad** - Fácil agregar nuevas billeteras en el futuro
4. **Mantenibilidad** - Código limpio y modular
5. **Performance** - Sin impacto en rendimiento

### 12.3 Valor Agregado

La implementación de billeteras virtuales en FinTrack Pro proporciona:

1. **Competitividad** - Funcionalidades que ofrece la competencia
2. **Diferenciación** - Transferencias entre mismas billeteras gratis
3. **Transparencia** - Comisiones visibles y registro detallado
4. **Conveniencia** - Gestión unificada de bancos y billeteras
5. **Control** - Trazabilidad completa de todas las transacciones

---

## 13. Preguntas Frecuentes (FAQ)

### 13.1 Preguntas Técnicas

**Q: ¿Por qué no crear una tabla separada para billeteras?**  
A: Porque las billeteras son cuentas financieras con las mismas operaciones (saldo, transferencias, pagos). Separarlas duplicaría lógica y complejidad.

**Q: ¿Cómo se detecta automáticamente el tipo de entidad?**  
A: Mediante la función `getBankType()` que compara el nombre del banco con una lista de billeteras conocidas.

**Q: ¿Qué pasa si agregan una nueva billetera?**  
A: Solo se agrega la entrada en `bankLogos.js` y la función `getBankType()` la detecta automáticamente.

**Q: ¿Las comisiones son configurables?**  
A: En esta implementación, las comisiones están hardcodeadas en el RPC. Para hacerlas configurables, se puede agregar una tabla de configuración.

### 13.2 Preguntas de Negocio

**Q: ¿Por qué las transferencias entre mismas billeteras son gratis?**  
A: Porque así lo definen Yape, Plin y Tunki en sus términos de uso. Es un diferenciador competitivo.

**Q: ¿Quién paga la comisión en transferencias entre billeteras diferentes?**  
A: El usuario que envía el dinero (se descuenta de su saldo).

**Q: ¿Se puede transferir de Yape a un banco?**  
A: Sí, pero con comisión (definida por la billetera, no por FinTrack Pro).

**Q: ¿Se pueden recibir transferencias de billeteras?**  
A: Sí, se registran como transferencias externas con el método de pago correspondiente.

---

**Fin del análisis**
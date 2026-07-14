export function recalculateBalances(supabase) {
  return supabase.functions.invoke('recalculate-balances', { body: {} });
}

export function validateFinanceOperation(supabase, payload) {
  return supabase.functions.invoke('validate-operation', { body: payload });
}

export async function validateFinanceOperationIfAvailable(supabase, payload) {
  const result = await validateFinanceOperation(supabase, payload);
  if (!result.error) {
    if (result.data?.ok === false) {
      return {
        data: null,
        error: { message: result.data.error || 'Operacion no permitida por validacion de backend.' },
      };
    }
    return result;
  }

  const message = result.error?.message || '';
  const isFunctionUnavailable = /failed to send|not found|404|function/i.test(message);

  if (isFunctionUnavailable) {
    return { data: { ok: true, skipped: true }, error: null };
  }

  return result;
}

export function exportBackendReport(supabase, payload) {
  return supabase.functions.invoke('export-report', { body: payload });
}

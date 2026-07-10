import React from 'react';
import { listUserPermissions } from '../services/admin.service';

export function usePermissions({ supabase, session, profile }) {
  const [permissions, setPermissions] = React.useState({});
  const isAdmin = profile?.role === 'admin';

  React.useEffect(() => {
    async function loadPermissions() {
      if (!supabase || !session?.user || !profile) return;
      if (isAdmin) {
        setPermissions({});
        return;
      }
      const { data, error } = await listUserPermissions(supabase, session.user.id);
      if (error) {
        setPermissions({});
        return;
      }
      setPermissions((data || []).reduce((map, row) => ({ ...map, [row.modulo]: row }), {}));
    }
    loadPermissions();
  }, [supabase, session?.user?.id, profile, isAdmin]);

  const can = React.useCallback((moduleId, action = 'view') => {
    if (isAdmin) return true;
    const row = permissions[moduleId];
    if (!row) return true;
    const map = { view: 'can_view', create: 'can_create', edit: 'can_edit', delete: 'can_delete', export: 'can_export' };
    return row[map[action]] !== false;
  }, [isAdmin, permissions]);

  return { can, isAdmin, permissions };
}

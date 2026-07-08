function required(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(`${label} es obligatorio.`);
  }
}

function cleanPayload(payload = {}, allowedFields = []) {
  if (!allowedFields.length) return { ...payload };
  return allowedFields.reduce((next, field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      next[field] = payload[field];
    }
    return next;
  }, {});
}

export function createCrudController({
  service,
  entityName,
  allowedFields = [],
  requiredFields = [],
  adminScoped = true,
}) {
  function validate(payload) {
    requiredFields.forEach((field) => required(payload?.[field], field));
  }

  return {
    async list(supabase, adminId, options = {}) {
      if (adminScoped) required(adminId, 'admin_id');
      const query = service.listCached
        ? service.listCached(supabase, adminId, options)
        : service.list(supabase, adminId, options.orderBy);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getById(supabase, id) {
      required(id, `${entityName}.id`);
      const { data, error } = await service.getById(supabase, id);
      if (error) throw error;
      return data;
    },

    async create(supabase, adminId, payload) {
      if (adminScoped) required(adminId, 'admin_id');
      validate(payload);
      const nextPayload = adminScoped
        ? { ...cleanPayload(payload, allowedFields), admin_id: adminId }
        : cleanPayload(payload, allowedFields);
      const { data, error } = await service.create(supabase, nextPayload);
      if (error) throw error;
      service.invalidateCache?.(adminId);
      return data;
    },

    async update(supabase, adminId, id, payload) {
      if (adminScoped) required(adminId, 'admin_id');
      required(id, `${entityName}.id`);
      const { data, error } = await service.update(supabase, id, cleanPayload(payload, allowedFields));
      if (error) throw error;
      service.invalidateCache?.(adminId);
      return data;
    },

    async remove(supabase, adminId, id) {
      if (adminScoped) required(adminId, 'admin_id');
      required(id, `${entityName}.id`);
      const { error } = await service.remove(supabase, id);
      if (error) throw error;
      service.invalidateCache?.(adminId);
      return true;
    },
  };
}


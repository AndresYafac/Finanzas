const BUCKET = 'comprobantes';
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function safeFileName(name) {
  return String(name || 'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function listAttachments(supabase, module, recordId) {
  return supabase.from('file_attachments').select('*').eq('module', module).eq('record_id', recordId).order('created_at', { ascending: false });
}

export async function uploadAttachment(supabase, adminId, userId, module, recordId, file) {
  if (!file) return { error: { message: 'Selecciona un archivo.' } };
  if (file.size > MAX_FILE_SIZE) return { error: { message: 'El comprobante no debe superar 5 MB.' } };
  const path = `${adminId}/${module}/${recordId}/${Date.now()}-${safeFileName(file.name)}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (upload.error) return upload;
  return supabase.from('file_attachments').insert({
    admin_id: adminId,
    module,
    record_id: recordId,
    bucket: BUCKET,
    path,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    created_by: userId,
  }).select().single();
}

export async function getAttachmentUrl(supabase, attachment) {
  return supabase.storage.from(attachment.bucket || BUCKET).createSignedUrl(attachment.path, 60);
}

export async function deleteAttachment(supabase, attachment) {
  const removeFile = await supabase.storage.from(attachment.bucket || BUCKET).remove([attachment.path]);
  if (removeFile.error) return removeFile;
  return supabase.from('file_attachments').delete().eq('id', attachment.id);
}

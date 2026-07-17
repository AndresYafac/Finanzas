import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorageClient } from '../config/firebase';

const STORAGE_PROVIDER = 'firebase';
const BUCKET_LABEL = 'firebase-storage';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function safeFileName(name) {
  return String(name || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-');
}

function buildPath(adminId, module, recordId, fileName) {
  return `fintrack/${adminId}/${module}/${recordId}/${Date.now()}-${safeFileName(fileName)}`;
}

function validateFile(file) {
  if (!file) return 'Selecciona un archivo.';
  if (!ALLOWED_TYPES.has(file.type)) return 'Solo se permiten imagenes JPG, PNG, WEBP o PDF.';
  if (file.size > MAX_FILE_SIZE) return 'El comprobante no debe superar 5 MB.';
  return '';
}

export function listAttachments(supabase, module, recordId) {
  return supabase
    .from('file_attachments')
    .select('*')
    .eq('module', module)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });
}

export async function uploadAttachment(supabase, adminId, userId, module, recordId, file) {
  const validationError = validateFile(file);
  if (validationError) return { error: { message: validationError } };

  const path = buildPath(adminId, module, recordId, file.name);

  try {
    const firebaseStorage = await getFirebaseStorageClient();
    const fileRef = ref(firebaseStorage, path);
    await uploadBytes(fileRef, file, {
      contentType: file.type,
      customMetadata: {
        admin_id: adminId,
        module,
        record_id: recordId,
        created_by: userId || '',
        provider: STORAGE_PROVIDER,
      },
    });

    return supabase.from('file_attachments').insert({
      admin_id: adminId,
      module,
      record_id: recordId,
      bucket: BUCKET_LABEL,
      path,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      created_by: userId,
    }).select().single();
  } catch (error) {
    return { error: { message: error.message || 'No se pudo subir el archivo a Firebase Storage.' } };
  }
}

export async function getAttachmentUrl(_supabase, attachment) {
  try {
    const firebaseStorage = await getFirebaseStorageClient();
    const url = await getDownloadURL(ref(firebaseStorage, attachment.path));
    return { data: { signedUrl: url }, error: null };
  } catch (error) {
    return { data: null, error: { message: error.message || 'No se pudo obtener el archivo.' } };
  }
}

export async function deleteAttachment(supabase, attachment) {
  try {
    const firebaseStorage = await getFirebaseStorageClient();
    await deleteObject(ref(firebaseStorage, attachment.path));
  } catch (error) {
    if (error?.code !== 'storage/object-not-found') {
      return { error: { message: error.message || 'No se pudo eliminar el archivo en Firebase Storage.' } };
    }
  }
  return supabase.from('file_attachments').delete().eq('id', attachment.id);
}

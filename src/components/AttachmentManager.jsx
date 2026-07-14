import React from 'react';
import { Download, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from './ui';
import { notify } from '../services/feedback';
import { deleteAttachment, getAttachmentUrl, listAttachments, uploadAttachment } from '../services/attachments.service';

export function AttachmentManager({ supabase, adminId, userId, module, recordId }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!recordId) return;
    const { data, error } = await listAttachments(supabase, module, recordId);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    setItems(data || []);
  }, [supabase, module, recordId]);

  React.useEffect(() => { load(); }, [load]);

  async function addFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLoading(true);
    const { error } = await uploadAttachment(supabase, adminId, userId, module, recordId, file);
    setLoading(false);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Comprobante adjuntado correctamente.', 'success');
    load();
  }

  async function download(item) {
    const { data, error } = await getAttachmentUrl(supabase, item);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function remove(item) {
    const { error } = await deleteAttachment(supabase, item);
    if (error) {
      notify(error.message, 'error');
      return;
    }
    notify('Comprobante eliminado.', 'success');
    load();
  }

  if (!recordId) return null;
  return (
    <section className="attachment-manager">
      <div className="attachment-header">
        <div>
          <strong>Comprobantes</strong>
          <span>PDF o imagen, maximo 5 MB.</span>
        </div>
        <label className={`btn btn-sm ${loading ? 'disabled' : ''}`}>
          <Upload size={14} /> Adjuntar
          <input type="file" accept="image/*,application/pdf" onChange={addFile} disabled={loading} hidden />
        </label>
      </div>
      <div className="attachment-list">
        {items.length ? items.map((item) => (
          <div className="attachment-item" key={item.id}>
            <Paperclip size={16} />
            <span>{item.file_name}</span>
            <Button size="sm" iconOnly onClick={() => download(item)} title="Ver comprobante"><Download size={14} /></Button>
            <Button size="sm" iconOnly variant="danger" onClick={() => remove(item)} title="Eliminar comprobante"><Trash2 size={14} /></Button>
          </div>
        )) : <p className="muted">Sin comprobantes adjuntos.</p>}
      </div>
    </section>
  );
}

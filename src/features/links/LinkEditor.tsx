import { useState } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { validUrl, type QuickLink } from './model';
export function LinkEditor({
  existing,
  onSave,
  onClose,
}: {
  existing?: QuickLink;
  onSave: (link: QuickLink) => boolean;
  onClose: () => void;
}) {
  const [initial] = useState<QuickLink>(
    () => existing ?? { id: crypto.randomUUID(), label: '', desc: '', url: '', scope: 'all' },
  );
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const canDiscard = useUnsavedChanges(JSON.stringify(initial) !== JSON.stringify(form));
  const close = () => {
    if (canDiscard()) onClose();
  };
  return (
    <Modal title={existing ? '링크 편집' : '링크 추가'} onClose={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.label.trim() || !validUrl(form.url.trim())) {
            setError(
              '이름과 올바른 http 또는 https URL을 입력해 주세요. 인증 정보가 포함된 URL은 사용할 수 없습니다.',
            );
            return;
          }
          if (
            onSave({
              ...form,
              label: form.label.trim(),
              desc: form.desc.trim(),
              url: form.url.trim(),
            })
          )
            onClose();
          else setError('저장하지 못했습니다. 입력 내용을 유지했습니다. 다시 저장해 주세요.');
        }}
      >
        <Field label="링크 이름">
          <input
            autoFocus
            required
            maxLength={100}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </Field>
        <Field label="URL">
          <input
            required
            maxLength={2000}
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </Field>
        <Field label="설명">
          <input
            maxLength={300}
            value={form.desc}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
          />
        </Field>
        <Field label="표시 범위">
          <select
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value as QuickLink['scope'] })}
          >
            <option value="all">공통</option>
            <option value="unity">Unity 개발</option>
            <option value="server">서버 · 웹 개발</option>
          </select>
        </Field>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" onClick={close}>
            취소
          </Button>
          <Button type="submit" variant="primary">
            링크 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}

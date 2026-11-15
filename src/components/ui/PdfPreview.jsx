// src/components/ui/PdfPreview.jsx
// Pratinjau PDF in-app: merender blob PDF lewat URL.createObjectURL.
// Unduh adalah aksi terpisah (tidak otomatis); object URL dicabut saat
// komponen ditutup supaya memori tidak bocor.
import React, { useEffect, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

const PdfPreview = ({ isOpen, onClose, blob, fileName = 'document.pdf', title = 'Pratinjau PDF' }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!isOpen || !blob) {
      return undefined;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [isOpen, blob]);

  if (!isOpen || !blob) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      subtitle={fileName}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          {url && (
            <a href={url} download={fileName}>
              <Button>
                <FileDown className="h-4 w-4" />
                Unduh PDF
              </Button>
            </a>
          )}
        </>
      }
    >
      {url ? (
        <iframe
          src={url}
          title={fileName}
          className="h-[70vh] w-full rounded-[10px] ring-1 ring-inset ring-slate-200/70 dark:ring-white/10"
        />
      ) : (
        <div className="flex h-[70vh] items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Memuat pratinjau…
        </div>
      )}
    </Modal>
  );
};

export default PdfPreview;

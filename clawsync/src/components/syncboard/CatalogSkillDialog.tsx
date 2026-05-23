import { CatalogDetailPanel } from './CatalogDetailPanel';
import { ModalDialog } from './ModalDialog';
import { CatalogDetailSkeleton } from '../ui/skeletons';
import type { ArkivQueryTrace } from '../../lib/arkivTrace';

type CatalogSkillDialogProps = {
  open: boolean;
  onClose: () => void;
  detail: Record<string, unknown> | null;
  arkivTrace?: ArkivQueryTrace | null;
  loading?: boolean;
  purchaseFee?: string;
  walletConfigured?: boolean;
  onPurchase?: () => void;
  purchaseLoading?: boolean;
  purchaseError?: string;
  purchaseLogs?: string[];
  purchaseElapsedSec?: number;
};

export function CatalogSkillDialog({
  open,
  onClose,
  detail,
  arkivTrace,
  loading = false,
  purchaseFee,
  walletConfigured,
  onPurchase,
  purchaseLoading,
  purchaseError,
  purchaseLogs,
  purchaseElapsedSec,
}: CatalogSkillDialogProps) {
  const payload = detail?.payload as Record<string, unknown> | undefined;
  const title = payload?.title ? String(payload.title) : 'Skill';
  const slug = payload?.skillName ? String(payload.skillName) : undefined;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={slug}
      className="modal-dialog--wide"
    >
      {loading ? (
        <CatalogDetailSkeleton />
      ) : detail ? (
        <CatalogDetailPanel
          detail={detail}
          arkivTrace={arkivTrace}
          purchaseFee={purchaseFee}
          walletConfigured={walletConfigured}
          onPurchase={onPurchase}
          purchaseLoading={purchaseLoading}
          purchaseError={purchaseError}
          purchaseLogs={purchaseLogs}
          purchaseElapsedSec={purchaseElapsedSec}
        />
      ) : (
        <CatalogDetailSkeleton />
      )}
    </ModalDialog>
  );
}

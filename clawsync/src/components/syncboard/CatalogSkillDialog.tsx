import { CatalogDetailPanel } from './CatalogDetailPanel';
import { ModalDialog } from './ModalDialog';
import { CatalogDetailSkeleton } from '../ui/skeletons';

type CatalogSkillDialogProps = {
  open: boolean;
  onClose: () => void;
  detail: Record<string, unknown> | null;
  loading?: boolean;
  purchaseFee?: string;
  walletConfigured?: boolean;
  walletAddress?: string | null;
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
  loading = false,
  purchaseFee,
  walletConfigured,
  walletAddress,
  onPurchase,
  purchaseLoading,
  purchaseError,
  purchaseLogs,
  purchaseElapsedSec,
}: CatalogSkillDialogProps) {
  const payload = detail?.payload as Record<string, unknown> | undefined;
  const title = payload?.title ? String(payload.title) : 'Skill details';

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      description="Full Arkiv catalog entry, purchase details, and metadata."
      className="modal-dialog--wide"
    >
      {loading ? (
        <CatalogDetailSkeleton />
      ) : detail ? (
        <CatalogDetailPanel
          detail={detail}
          purchaseFee={purchaseFee}
          walletConfigured={walletConfigured}
          walletAddress={walletAddress}
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

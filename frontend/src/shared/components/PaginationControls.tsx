interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  limit,
  total,
  disabled = false,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <nav className="pagination" aria-label="Pagination">
      <span>
        Page {page} of {totalPages}
      </span>
      <div>
        <Button
          type="button"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <CaretLeft size={15} aria-hidden="true" />
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <CaretRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from './Button';

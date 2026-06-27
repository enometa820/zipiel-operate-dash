-- AC-1: status EN label fix — 'On Hold' → 'Payment Pending'.
-- effie canonical m = 지급 대기 (Payment Pending). 0001 was correct; 0003 mis-renamed
-- it to 'On Hold'. KO label ('지급 대기') and phase (Payment) were already correct.
-- enum rename preserves existing rows automatically (no data movement).
alter type collab_status rename value 'On Hold' to 'Payment Pending';

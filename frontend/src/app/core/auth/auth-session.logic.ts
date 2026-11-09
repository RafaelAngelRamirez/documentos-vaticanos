/**
 * When a failed GET /me ends the stored session.
 * Pure: no Angular, no storage. Only HTTP 401.
 */

/** Status of a failed GET /me. A non-HTTP failure counts as 0 (no network). */
export function meFailureStatus(err: unknown): number {
  if (typeof err !== 'object' || err === null || !('status' in err)) return 0;
  const status = (err as { status: unknown }).status;
  if (typeof status !== 'number' || !Number.isInteger(status) || status < 0) {
    return 0;
  }
  return status;
}

/** True only for 401. Network loss and other statuses keep the stored user. */
export function sessionEndsOnMeFailure(status: number): boolean {
  return status === 401;
}

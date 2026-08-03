/** Your backend combines validation errors into one message string
 *  (see middleware/validate.js), not per-field errors — so we just
 *  surface that message directly rather than trying to map it to fields. */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.message || fallback
}
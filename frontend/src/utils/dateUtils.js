// Formats any date string, ISO timestamp, or Date object consistently across the app.
export function formatDateTime(dateInput) {
  if (!dateInput) {
    return new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  const dateObj = new Date(dateInput);
  if (isNaN(dateObj.getTime())) {
    return String(dateInput);
  }

  return dateObj.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

/**
 * Helper to ensure a clinician's name is formatted with "Dr." prefix.
 * If the name already starts with "Dr", "Dr.", "Docteur", "Pr" or "Pr.", it returns the name unchanged.
 */
export function formatDoctorName(name?: string | null): string {
  if (!name) return 'Dr. Slim';
  
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  
  if (
    lower.startsWith('dr') || 
    lower.startsWith('docteur') || 
    lower.startsWith('pr') || 
    lower.startsWith('professeur')
  ) {
    return trimmed;
  }
  
  return `Dr. ${trimmed}`;
}

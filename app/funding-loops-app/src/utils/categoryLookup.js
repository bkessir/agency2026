// CRA registered charity category codes → human-readable labels
// Source: cra.cra_category_lookup table
const CATEGORY_MAP = {
  '0001': 'Organizations Relieving Poverty',
  '0002': 'Foundations Relieving Poverty',
  '0010': 'Teaching Institutions',
  '0011': 'Support of Schools & Education',
  '0012': 'Education in the Arts',
  '0013': 'Educational Organizations',
  '0014': 'Research',
  '0015': 'Foundations Advancing Education',
  '0030': 'Christianity',
  '0040': 'Islam',
  '0050': 'Judaism',
  '0060': 'Other Religions',
  '0070': 'Support of Religion',
  '0080': 'Ecumenical / Inter-faith',
  '0090': 'Foundations Advancing Religions',
  '0100': 'Core Health Care',
  '0110': 'Supportive Health Care',
  '0120': 'Protective Health Care',
  '0130': 'Health Care Products',
  '0140': 'Complementary Health Care',
  '0150': 'Relief of the Aged',
  '0155': 'Upholding Human Rights',
  '0160': 'Community Resource',
  '0170': 'Environment',
  '0175': 'Agriculture',
  '0180': 'Animal Welfare',
  '0190': 'Arts',
  '0200': 'Public Amenities',
  '0210': 'Foundations',
  '0215': 'NASO',
}

/**
 * Returns the human-readable label for a CRA category code.
 * Handles zero-padded ("0030") and plain ("30") formats.
 * @param {string|number} code
 * @returns {string}
 */
export function categoryLabel(code) {
  if (!code) return '—'
  const padded = String(code).padStart(4, '0')
  return CATEGORY_MAP[padded] || String(code)
}

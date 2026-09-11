export const APP_VERSION = '8.0';
export const TEMPLATE_FILENAME = `RE_Partition_Template_v${APP_VERSION}.xlsx`;

export const DEFAULTS = {
  discountRate: 6.5,
  cashEquiv: 0,
  pctA: 40,
  partnerNameA: 'Partner A',
  partnerNameB: 'Partner B',
} as const;

export const IDLE_UPLOAD_MESSAGE = 'No file loaded — enter manually or upload Excel';

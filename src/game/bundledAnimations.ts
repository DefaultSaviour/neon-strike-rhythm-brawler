import { SIGNATURE_DANCES } from './signatureDances';

/**
 * Custom enemy animations that ship with the game. By default these are each
 * enemy's signature dance (see signatureDances.ts).
 *
 * To ship animations made in the Animation Studio, use its "Export" button
 * and paste the downloaded file's contents here in place of
 * SIGNATURE_DANCES (the export already includes these dances, plus your
 * changes). Anything saved in the studio without exporting lives only in
 * that browser and overrides what's here.
 */
export const BUNDLED_ANIMATIONS: unknown = SIGNATURE_DANCES;

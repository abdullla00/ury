import { call } from './frappe-sdk';

export interface POSOpeningResponse {
  message: number;
}

export type POSOpeningStatus = 0 | 1 | 2;

export interface POSCloseValidationResponse {
  message: string;
}

export const checkPOSOpening = async (): Promise<POSOpeningResponse> => {
  try {
    const response = await call.get<POSOpeningResponse>(
      'ury.ury_pos.api.posOpening'
    );
    
    return response;
  } catch (error) {
    console.error('Error checking POS opening status:', error);
    throw error;
  }
};

export const refreshPosOpeningForToday = async () => {
  const response = await call.post<{ message: { updated: string[]; status: string } }>(
    'ury.ury_pos.api.refresh_pos_opening_for_today'
  );
  return response.message;
};

export const validatePOSClose = async (posProfile: string): Promise<POSCloseValidationResponse> => {
  try {
    const response = await call.get<POSCloseValidationResponse>(
      'ury.ury_pos.api.validate_pos_close',
      {
        pos_profile: posProfile
      }
    );
    
    return response;
  } catch (error) {
    console.error('Error validating POS close status:', error);
    throw error;
  }
}; 
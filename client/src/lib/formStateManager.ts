import { offlineStorage } from './offlineStorage';
import { debugLogger } from './debugLogger';

export type FormDraftData = {
  // Implant Report Form fields
  hospitalId?: string;
  procedureDate?: string;
  procedureType?: string;
  deviceUsed?: string;
  deviceSource?: 'car' | 'external' | 'hospital';
  deviceSerialNumber?: string;
  deviceLotNumber?: string;
  notes?: string;
  materials?: any[];
  leads?: any[];
  otherMaterials?: any[];
};

export class FormStateManager {
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 3000; // Auto-save after 3 seconds of inactivity
  
  /**
   * Auto-save form data with debouncing
   * @param formId - Unique identifier for the form (e.g., 'implant-report')
   * @param userId - Current user ID
   * @param formData - Form data to save
   * @param route - Route to restore when reopening
   */
  autoSave(formId: string, userId: string, formData: FormDraftData, route: string): void {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Check if form has any meaningful data (not all empty)
    const hasData = this.hasSignificantData(formData);
    
    if (!hasData) {
      debugLogger.info('📝 Form has no data, skipping auto-save');
      return;
    }

    // Set new timeout
    this.saveTimeout = setTimeout(async () => {
      try {
        await offlineStorage.saveFormDraft(formId, userId, formData, route);
        debugLogger.info(`💾 Auto-saved form: ${formId}`);
      } catch (error) {
        debugLogger.error('Failed to auto-save form:', error);
      }
    }, this.DEBOUNCE_MS);
  }

  /**
   * Cancel any pending auto-save
   */
  cancelAutoSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  /**
   * Check if form has any significant data entered
   */
  private hasSignificantData(formData: FormDraftData): boolean {
    // Check if at least one field has meaningful content
    const { 
      hospitalId, 
      procedureType,
      deviceUsed,
      notes,
      materials,
      leads,
      otherMaterials
    } = formData;

    const hasText = 
      !!(procedureType && procedureType.trim().length > 0) ||
      !!(notes && notes.trim().length > 0);

    const hasSelections = 
      !!hospitalId ||
      !!deviceUsed;

    const hasMaterials =
      !!(materials && materials.some(m => m.name && m.name.trim().length > 0)) ||
      !!(leads && leads.some(l => l.name && l.name.trim().length > 0)) ||
      !!(otherMaterials && otherMaterials.some(o => o.name && o.name.trim().length > 0));

    return hasText || hasSelections || hasMaterials;
  }

  /**
   * Get saved draft for a form
   * @param formId - Unique identifier for the form
   * @returns Saved draft or null
   */
  async getDraft(formId: string): Promise<{ formData: FormDraftData; route: string } | null> {
    try {
      const draft = await offlineStorage.getFormDraft(formId);
      if (draft) {
        debugLogger.info(`📄 Found saved draft for: ${formId}`, { timestamp: new Date(draft.timestamp).toISOString() });
        return {
          formData: draft.formData,
          route: draft.route,
        };
      }
      return null;
    } catch (error) {
      debugLogger.error('Failed to get form draft:', error);
      return null;
    }
  }

  /**
   * Delete saved draft
   * @param formId - Unique identifier for the form
   */
  async deleteDraft(formId: string): Promise<void> {
    this.cancelAutoSave(); // Cancel any pending saves
    try {
      await offlineStorage.deleteFormDraft(formId);
      debugLogger.info(`🗑️ Deleted draft for: ${formId}`);
    } catch (error) {
      debugLogger.error('Failed to delete form draft:', error);
    }
  }

  /**
   * Check if a draft exists for this form
   * @param formId - Unique identifier for the form
   * @returns True if draft exists
   */
  async hasDraft(formId: string): Promise<boolean> {
    const draft = await this.getDraft(formId);
    return draft !== null && draft !== undefined;
  }

  /**
   * Get all drafts for current user
   * @param userId - Current user ID
   * @returns Array of drafts
   */
  async getAllDrafts(userId: string): Promise<Array<{ id: string; timestamp: number; route: string }>> {
    try {
      const drafts = await offlineStorage.getAllFormDrafts(userId);
      return drafts.map(d => ({
        id: d.id,
        timestamp: d.timestamp,
        route: d.route,
      }));
    } catch (error) {
      debugLogger.error('Failed to get all drafts:', error);
      return [];
    }
  }
}

// Singleton instance
export const formStateManager = new FormStateManager();

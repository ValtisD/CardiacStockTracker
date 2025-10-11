/**
 * GS1 Barcode Parser
 * Parses GS1-compliant barcodes commonly used in medical devices
 * 
 * Common Application Identifiers (AIs):
 * - (01) GTIN - 14 digits - Product/Item identifier
 * - (17) Expiration Date - 6 digits (YYMMDD)
 * - (21) Serial Number - Variable length
 * - (10) Lot/Batch Number - Variable length
 */

export interface GS1Data {
  gtin?: string;           // (01) Product identifier
  expirationDate?: string; // (17) Parsed to YYYY-MM-DD format
  serialNumber?: string;   // (21) Serial number
  lotNumber?: string;      // (10) Lot/batch number
  raw: string;             // Original barcode
}

// Application Identifiers with fixed lengths (excluding the AI itself)
const FIXED_LENGTH_AIS: { [key: string]: number } = {
  '01': 14, // GTIN
  '17': 6,  // Expiration date (YYMMDD)
};

/**
 * Parse a GS1 barcode string
 * @param barcode The raw barcode string
 * @returns Parsed GS1 data with extracted fields
 */
export function parseGS1Barcode(barcode: string): GS1Data {
  const result: GS1Data = { raw: barcode };
  
  if (!barcode || barcode.length < 4) {
    return result;
  }
  
  let position = 0;
  
  while (position < barcode.length) {
    // Check if we can read at least 2 characters for AI
    if (position + 2 > barcode.length) break;
    
    // Read the Application Identifier (2-4 digits, but we'll check 2 first)
    const ai2 = barcode.substring(position, position + 2);
    const ai3 = barcode.substring(position, position + 3);
    const ai4 = barcode.substring(position, position + 4);
    
    let ai: string;
    let dataStart: number;
    
    // Determine AI length (check longer AIs first)
    if (FIXED_LENGTH_AIS[ai4]) {
      ai = ai4;
      dataStart = position + 4;
    } else if (FIXED_LENGTH_AIS[ai3]) {
      ai = ai3;
      dataStart = position + 3;
    } else if (FIXED_LENGTH_AIS[ai2]) {
      ai = ai2;
      dataStart = position + 2;
    } else {
      // Unknown AI, try as 2-digit and read until next AI or end
      ai = ai2;
      dataStart = position + 2;
    }
    
    // Extract the data
    let data: string;
    const fixedLength = FIXED_LENGTH_AIS[ai];
    
    if (fixedLength) {
      // Fixed length AI - read exact number of characters
      data = barcode.substring(dataStart, dataStart + fixedLength);
      position = dataStart + fixedLength;
    } else {
      // Variable length AI - read until next AI or end of barcode
      // For variable-length fields (10, 21), read to end unless we find a valid next AI
      let dataEnd = dataStart;
      
      // For variable-length fields, we need to be careful not to misinterpret data as AIs
      // The safest approach: only stop if we find a FIXED-length AI (more reliable detection)
      // or if we're certain we've found a variable AI at the right position
      while (dataEnd < barcode.length) {
        const next2 = barcode.substring(dataEnd, dataEnd + 2);
        const next3 = barcode.substring(dataEnd, dataEnd + 3);
        const next4 = barcode.substring(dataEnd, dataEnd + 4);
        
        let foundValidAI = false;
        
        // Prioritize fixed-length AIs - these are most reliable
        if (FIXED_LENGTH_AIS[next4]) {
          const requiredLength = 4 + FIXED_LENGTH_AIS[next4];
          if (dataEnd + requiredLength <= barcode.length) {
            foundValidAI = true;
          }
        }
        else if (FIXED_LENGTH_AIS[next3]) {
          const requiredLength = 3 + FIXED_LENGTH_AIS[next3];
          if (dataEnd + requiredLength <= barcode.length) {
            foundValidAI = true;
          }
        }
        else if (FIXED_LENGTH_AIS[next2]) {
          const requiredLength = 2 + FIXED_LENGTH_AIS[next2];
          if (dataEnd + requiredLength <= barcode.length) {
            foundValidAI = true;
          }
        }
        
        if (foundValidAI) {
          break;
        }
        dataEnd++;
      }
      
      data = barcode.substring(dataStart, dataEnd);
      position = dataEnd;
    }
    
    // Parse based on AI
    switch (ai) {
      case '01':
        result.gtin = data;
        break;
      case '17':
        result.expirationDate = parseGS1Date(data);
        break;
      case '21':
        result.serialNumber = data;
        break;
      case '10':
        result.lotNumber = data;
        break;
    }
  }
  
  return result;
}

/**
 * Parse GS1 date format (YYMMDD) to YYYY-MM-DD
 * @param dateStr Date string in YYMMDD format
 * @returns Date in YYYY-MM-DD format or undefined if invalid
 */
function parseGS1Date(dateStr: string): string | undefined {
  if (dateStr.length !== 6) return undefined;
  
  const yy = dateStr.substring(0, 2);
  const mm = dateStr.substring(2, 4);
  const dd = dateStr.substring(4, 6);
  
  // Convert YY to YYYY (assume 2000s if < 50, otherwise 1900s)
  const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
  
  // Validate month and day
  const monthNum = parseInt(mm);
  const dayNum = parseInt(dd);
  
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return undefined;
  }
  
  return `${year}-${mm}-${dd}`;
}

/**
 * Format GS1 data for display (with human-readable AIs in parentheses)
 * @param data Parsed GS1 data
 * @returns Formatted string with AIs in parentheses
 */
export function formatGS1Display(data: GS1Data): string {
  const parts: string[] = [];
  
  if (data.gtin) {
    parts.push(`(01)${data.gtin}`);
  }
  if (data.expirationDate) {
    // Convert back to YYMMDD for display
    const date = new Date(data.expirationDate);
    const yy = date.getFullYear().toString().substring(2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    parts.push(`(17)${yy}${mm}${dd}`);
  }
  if (data.serialNumber) {
    parts.push(`(21)${data.serialNumber}`);
  }
  if (data.lotNumber) {
    parts.push(`(10)${data.lotNumber}`);
  }
  
  return parts.join(' ');
}

/**
 * Check if a barcode appears to be GS1 format
 * @param barcode Raw barcode string
 * @returns True if barcode starts with common GS1 AI
 */
export function isGS1Barcode(barcode: string): boolean {
  if (!barcode || barcode.length < 16) return false;
  
  // Check if starts with common GS1 AI
  const ai = barcode.substring(0, 2);
  return ai === '01' || ai === '17' || ai === '21' || ai === '10';
}

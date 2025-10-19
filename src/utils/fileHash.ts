/**
 * Utility functions for file hashing
 */

/**
 * Calculates SHA-256 hash of a file
 * @param file - The file to hash
 * @returns Promise<string> - Hex string representation of the hash
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Error calculating file hash:', error);
    throw new Error('Failed to calculate file hash');
  }
}

/**
 * Calculates a consistent hash based on file content only
 * Uses file.slice() to avoid detaching the main buffer
 * Hash is based on: file size + name + actual content chunks
 * @param file - The file to hash
 * @param chunkSize - Size of chunks to read (default 128KB)
 * @returns Promise<string> - Hex string representation of the hash
 */
export async function calculateQuickFileHash(
  file: File,
  chunkSize: number = 128 * 1024
): Promise<string> {
  try {
    console.log('[FileHash] Calculating hash for:', {
      name: file.name,
      size: file.size,
    });
    
    const fileSize = file.size;
    const encoder = new TextEncoder();
    
    // Create metadata WITHOUT lastModified to ensure consistency
    const metadata = `${file.name}|${fileSize}`;
    const metadataBytes = encoder.encode(metadata);
    
    let contentChunks: Uint8Array[] = [];
    
    if (fileSize === 0) {
      // Empty file - just use metadata
      contentChunks.push(metadataBytes);
    } else if (fileSize <= chunkSize) {
      // Small file - read entire content
      console.log('[FileHash] Small file - reading entire content');
      const buffer = await file.slice(0, fileSize).arrayBuffer();
      contentChunks.push(new Uint8Array(buffer));
      contentChunks.push(metadataBytes);
    } else {
      // Large file - read first, middle, and last chunks for better uniqueness
      console.log('[FileHash] Large file - reading first, middle, and last chunks');
      
      const firstChunk = await file.slice(0, chunkSize).arrayBuffer();
      contentChunks.push(new Uint8Array(firstChunk));
      
      // Read middle chunk
      const middleStart = Math.floor((fileSize - chunkSize) / 2);
      const middleChunk = await file.slice(middleStart, middleStart + chunkSize).arrayBuffer();
      contentChunks.push(new Uint8Array(middleChunk));
      
      // Read last chunk
      const lastChunk = await file.slice(fileSize - chunkSize, fileSize).arrayBuffer();
      contentChunks.push(new Uint8Array(lastChunk));
      
      contentChunks.push(metadataBytes);
    }
    
    // Combine all chunks
    const totalLength = contentChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const dataToHash = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of contentChunks) {
      dataToHash.set(chunk, offset);
      offset += chunk.length;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('[FileHash] Hash calculated:', hashHex.substring(0, 16) + '...', 'from', totalLength, 'bytes');
    return hashHex;
  } catch (error) {
    console.error('[FileHash] Error calculating file hash:', error);
    throw new Error('Failed to calculate file hash');
  }
}

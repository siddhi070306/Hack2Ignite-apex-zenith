// Generates a SHA-256 hash of a string using the browser's Web Crypto API.
export async function generateSHA256(message) {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Error generating hash:', error);
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return '0x' + Math.abs(hash).toString(16).padEnd(64, 'a');
  }
}

// Generates a simulated Polygon transaction hash (used until a live wallet/contract is wired up).
export function generateTxHash() {
  const characters = '0123456789abcdef';
  let tx = '0x';
  for (let i = 0; i < 64; i++) {
    tx += characters[Math.floor(Math.random() * 16)];
  }
  return tx;
}

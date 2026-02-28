export function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📘',
    success: '✅',
    error: '❌',
    music: '🎵',
    voice: '🔊'
  }[type] || '📘';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

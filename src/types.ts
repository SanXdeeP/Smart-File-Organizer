export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  category: string;
  status: 'unorganized' | 'organizing' | 'organized';
  hash?: string;
  isDuplicate?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface AppConfig {
  categories: Record<string, string[]>;
  autoRemoveDuplicates: boolean;
  simulationSpeed: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  categories: {
    Images: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
    Videos: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    Documents: ['pdf', 'doc', 'docx', 'txt', 'csv', 'xlsx', 'pptx'],
    Music: ['mp3', 'wav', 'ogg', 'flac'],
    Programs: ['exe', 'msi', 'dmg', 'sh', 'py', 'js', 'ts'],
    Archives: ['zip', 'rar', '7z', 'tar', 'gz'],
  },
  autoRemoveDuplicates: false,
  simulationSpeed: 400,
};

export const getCategory = (extension: string, customCategories?: Record<string, string[]>): string => {
  const ext = extension.toLowerCase().replace('.', '');
  const categories = customCategories || DEFAULT_CONFIG.categories;
  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(ext)) return category;
  }
  return 'Others';
};

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

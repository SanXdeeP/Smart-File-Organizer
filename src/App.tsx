import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Folder, 
  File, 
  Upload, 
  Play, 
  CheckCircle2, 
  Trash2, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Music, 
  Terminal, 
  Archive,
  ChevronRight,
  Info,
  Download,
  Eye,
  AlertTriangle,
  X,
  FileSearch,
  Settings,
  LayoutDashboard,
  ListTodo,
  BarChart3,
  Activity,
  Search,
  Plus,
  Save,
  RotateCcw,
  Gauge,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { FileItem, LogEntry, AppConfig, DEFAULT_CONFIG, getCategory, formatSize } from './types';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Images: <ImageIcon className="w-4 h-4" />,
  Videos: <Video className="w-4 h-4" />,
  Documents: <FileText className="w-4 h-4" />,
  Music: <Music className="w-4 h-4" />,
  Programs: <Terminal className="w-4 h-4" />,
  Archives: <Archive className="w-4 h-4" />,
  Others: <File className="w-4 h-4" />,
};

interface ExtendedFileItem extends FileItem {
  rawFile?: File;
  previewUrl?: string;
}

type ViewMode = 'dashboard' | 'logs' | 'settings' | 'statistics';

export default function App() {
  const [files, setFiles] = useState<ExtendedFileItem[]>([]);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeView, setActiveView] = useState<ViewMode>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewFile, setPreviewFile] = useState<ExtendedFileItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (activeView === 'logs') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeView]);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  const calculateHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []) as File[];
    if (uploadedFiles.length === 0) return;

    addLog(`Scanning ${uploadedFiles.length} new files...`, 'info');
    const newFiles: ExtendedFileItem[] = [];

    for (const file of uploadedFiles) {
      const extension = file.name.split('.').pop() || '';
      const hash = await calculateHash(file);
      
      const isDuplicate = files.some(f => f.hash === hash) || newFiles.some(f => f.hash === hash);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      if (isDuplicate) {
        addLog(`Duplicate detected: ${file.name}`, 'warning');
      }

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        extension,
        category: getCategory(extension, config.categories),
        status: 'unorganized',
        rawFile: file,
        hash,
        isDuplicate,
        previewUrl
      });
    }
    
    setFiles((prev) => [...prev, ...newFiles]);
    addLog(`Successfully imported ${newFiles.length} files.`, 'success');
  };

  const startOrganization = async () => {
    if (files.length === 0) return;
    setIsOrganizing(true);
    setProgress(0);
    addLog('Starting file organization process...', 'info');

    const unorganized = files.filter(f => f.status !== 'organized');
    const total = unorganized.length;
    let completed = 0;

    for (const file of files) {
      if (file.status === 'organized') continue;
      
      setFiles((prev) => 
        prev.map((f) => f.id === file.id ? { ...f, status: 'organizing' } : f)
      );
      
      await new Promise(resolve => setTimeout(resolve, config.simulationSpeed));
      
      setFiles((prev) => 
        prev.map((f) => f.id === file.id ? { ...f, status: 'organized' } : f)
      );
      
      completed++;
      setProgress(Math.round((completed / total) * 100));
      addLog(`Organized: ${file.name} -> ${file.category}/`, 'success');
    }

    setIsOrganizing(false);
    setProgress(100);
    addLog('Organization complete. All files sorted.', 'success');
  };

  const downloadZip = async () => {
    const organized = files.filter(f => f.status === 'organized');
    if (organized.length === 0) return;

    setIsDownloading(true);
    addLog('Generating ZIP archive...', 'info');
    const zip = new JSZip();

    organized.forEach((file) => {
      if (file.rawFile) {
        zip.folder(file.category)?.file(file.name, file.rawFile);
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `organized_files_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDownloading(false);
    addLog('ZIP archive exported successfully.', 'success');
  };

  const clearFiles = () => {
    files.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
    setIsOrganizing(false);
    setProgress(0);
    setLogs([]);
    addLog('Workspace cleared.', 'info');
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    addLog('File removed from queue.', 'info');
  };

  const stats = useMemo(() => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    const categoryCounts = files.reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalSize,
      categoryCounts,
      duplicateCount: files.filter(f => f.isDuplicate).length,
      organizedCount: files.filter(f => f.status === 'organized').length,
    };
  }, [files]);

  const organizedFiles = files.filter(f => f.status === 'organized');
  const unorganizedFiles = files.filter(f => f.status !== 'organized');

  const groupedFiles = organizedFiles.reduce((acc, file) => {
    if (!acc[file.category]) acc[file.category] = [];
    acc[file.category].push(file);
    return acc;
  }, {} as Record<string, ExtendedFileItem[]>);

  return (
    <div className="flex h-screen bg-[#f0f2f5] text-slate-900 font-sans overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Folder className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">FileOrganizer Pro</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-slate-800 rounded-lg lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'statistics', icon: BarChart3, label: 'Statistics' },
            { id: 'logs', icon: Activity, label: 'System Logs' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => {
                setActiveView(item.id as ViewMode);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Engine Active</span>
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed">
            v2.0.4 Professional Edition<br />
            © 2026 Automation Systems
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {activeView.replace(/^\w/, c => c.toUpperCase())}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {isOrganizing && (
              <div className="flex items-center gap-2 md:gap-4 w-32 md:w-64">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                  <motion.div 
                    className="h-full bg-indigo-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] md:text-xs font-mono font-bold text-indigo-600">{progress}%</span>
              </div>
            )}
            <div className="h-8 w-px bg-slate-200 mx-1 md:mx-2" />
            <button 
              onClick={clearFiles}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Reset Workspace"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Files</p>
                    <p className="text-xl md:text-2xl font-bold text-slate-900">{files.length}</p>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Size</p>
                    <p className="text-xl md:text-2xl font-bold text-slate-900">{formatSize(stats.totalSize)}</p>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Organized</p>
                    <p className="text-xl md:text-2xl font-bold text-emerald-600">{stats.organizedCount}</p>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Duplicates</p>
                    <p className="text-xl md:text-2xl font-bold text-amber-600">{stats.duplicateCount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left: Upload & Unorganized */}
                  <div className="lg:col-span-5 space-y-6">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative border-2 border-dashed border-slate-300 rounded-3xl p-10 text-center hover:border-indigo-500 hover:bg-indigo-50/50 transition-all cursor-pointer bg-white"
                    >
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                      />
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                          <Upload className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-slate-900">Import Files</p>
                          <p className="text-sm text-slate-500">Drag & drop or click to browse</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base">
                          <ListTodo className="w-4 h-4 text-slate-400" />
                          Queue ({unorganizedFiles.length})
                        </h3>
                        {unorganizedFiles.length > 0 && !isOrganizing && (
                          <button 
                            onClick={startOrganization}
                            className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 text-white text-[10px] md:text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Run
                          </button>
                        )}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                        {unorganizedFiles.length === 0 ? (
                          <div className="py-16 text-center text-slate-400">
                            <FileSearch className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm italic">Queue is empty</p>
                          </div>
                        ) : (
                          unorganizedFiles.map((file) => (
                            <motion.div 
                              key={file.id}
                              layout
                              className={`flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors group ${file.isDuplicate ? 'bg-amber-50/50' : ''}`}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-slate-100 rounded-xl text-slate-500 shrink-0">
                                  <File className="w-4 h-4" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">{formatSize(file.size)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setPreviewFile(file)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => removeFile(file.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Organized View */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-200 min-h-[400px] md:min-h-[600px] flex flex-col shadow-sm">
                      <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg md:text-xl font-bold text-slate-900">Virtual Directory</h3>
                          <p className="text-xs md:text-sm text-slate-500">Organized structure preview</p>
                        </div>
                        {organizedFiles.length > 0 && (
                          <button 
                            onClick={downloadZip}
                            disabled={isDownloading}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 w-full sm:w-auto"
                          >
                            {isDownloading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            Export
                          </button>
                        )}
                      </div>

                      <div className="flex-1 p-6">
                        {organizedFiles.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                            <Folder className="w-16 h-16 opacity-10" />
                            <p className="text-sm font-medium">Run automation to populate directory</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Object.entries(groupedFiles) as [string, ExtendedFileItem[]][]).map(([category, categoryFiles]) => (
                              <motion.div 
                                key={category}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-5 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white rounded-xl shadow-sm text-indigo-600">
                                      {CATEGORY_ICONS[category] || <Folder className="w-4 h-4" />}
                                    </div>
                                    <h4 className="font-bold text-slate-800">{category}</h4>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg">
                                    {categoryFiles.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {categoryFiles.slice(0, 3).map((file) => (
                                    <div key={file.id} className="flex items-center justify-between group/item">
                                      <div className="flex items-center gap-2 text-xs text-slate-500 overflow-hidden">
                                        <span className="truncate">{file.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                                        <button 
                                          onClick={() => setPreviewFile(file)}
                                          className="p-1 hover:bg-indigo-50 rounded text-indigo-600"
                                        >
                                          <Eye className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  {categoryFiles.length > 3 && (
                                    <p className="text-[10px] text-slate-400 pl-1 italic">
                                      + {categoryFiles.length - 3} more files
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'statistics' && (
              <motion.div 
                key="statistics"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Storage Distribution</h3>
                  <div className="space-y-6">
                    {(Object.entries(stats.categoryCounts) as [string, number][]).map(([category, count]) => {
                      const percentage = files.length > 0 ? Math.round((count / files.length) * 100) : 0;
                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex justify-between text-sm font-bold">
                            <span className="text-slate-700">{category}</span>
                            <span className="text-slate-400">{count} files ({percentage}%)</span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-indigo-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {files.length === 0 && (
                      <p className="text-center text-slate-400 py-12 italic">No data available to analyze</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">File Health</h3>
                    <div className="flex items-center gap-8">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full" viewBox="0 0 36 36">
                          <path
                            className="text-slate-100"
                            strokeDasharray="100, 100"
                            strokeWidth="3"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-emerald-500"
                            strokeDasharray={`${files.length > 0 ? ((files.length - stats.duplicateCount) / files.length) * 100 : 0}, 100`}
                            strokeWidth="3"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-slate-900">
                            {files.length > 0 ? Math.round(((files.length - stats.duplicateCount) / files.length) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-slate-700">Unique Files</p>
                        <p className="text-xs text-slate-500">Percentage of files that are not duplicates.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Efficiency</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Avg. Processing Time</span>
                        <span className="text-sm font-mono font-bold text-indigo-600">{config.simulationSpeed}ms / file</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Redundancy Ratio</span>
                        <span className="text-sm font-mono font-bold text-amber-600">
                          {files.length > 0 ? (stats.duplicateCount / files.length).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'logs' && (
              <motion.div 
                key="logs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 bg-slate-900 rounded-3xl p-6 font-mono text-sm overflow-y-auto shadow-2xl border border-slate-800">
                  <div className="flex items-center gap-2 mb-6 text-slate-500 border-b border-slate-800 pb-4">
                    <Terminal className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-widest font-bold">System Output Console</span>
                  </div>
                  <div className="space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-slate-700 italic">Waiting for system events...</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="flex gap-4 group">
                          <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                          <span className={`shrink-0 font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                            log.level === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                            log.level === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                            log.level === 'error' ? 'bg-red-500/10 text-red-500' :
                            'bg-indigo-500/10 text-indigo-500'
                          }`}>
                            {log.level}
                          </span>
                          <span className="text-slate-300 group-hover:text-white transition-colors">{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-4xl mx-auto space-y-6 md:space-y-8"
              >
                <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                    <h3 className="text-lg md:text-xl font-bold text-slate-900">Category Mappings</h3>
                    <button 
                      onClick={() => setConfig(DEFAULT_CONFIG)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 self-start"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to Default
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {(Object.entries(config.categories) as [string, string[]][]).map(([category, extensions]) => (
                      <div key={category} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <div className="md:col-span-1 pt-2">
                          <label className="text-sm font-bold text-slate-700">{category}</label>
                        </div>
                        <div className="md:col-span-3">
                          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            {extensions.map(ext => (
                              <span key={ext} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 flex items-center gap-1">
                                {ext}
                              </span>
                            ))}
                            <button className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Automation Engine</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">Processing Speed</p>
                        <p className="text-sm text-slate-500">Delay between file operations (ms)</p>
                      </div>
                      <input 
                        type="range" 
                        min="50" 
                        max="1000" 
                        step="50"
                        value={config.simulationSpeed}
                        onChange={(e) => setConfig(prev => ({ ...prev, simulationSpeed: parseInt(e.target.value) }))}
                        className="w-48 accent-indigo-600"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">Auto-Clean Duplicates</p>
                        <p className="text-sm text-slate-500">Automatically remove identical files on import</p>
                      </div>
                      <button 
                        onClick={() => setConfig(prev => ({ ...prev, autoRemoveDuplicates: !prev.autoRemoveDuplicates }))}
                        className={`w-12 h-6 rounded-full transition-all relative ${config.autoRemoveDuplicates ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.autoRemoveDuplicates ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20">
                    <Save className="w-5 h-5" />
                    Save Configuration
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600">
                    {CATEGORY_ICONS[previewFile.category] || <File className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 truncate max-w-[300px]">{previewFile.name}</h3>
                    <p className="text-xs text-slate-500">{previewFile.category} • {formatSize(previewFile.size)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto bg-slate-50 p-8 flex items-center justify-center">
                {previewFile.type.startsWith('image/') ? (
                  <img 
                    src={previewFile.previewUrl} 
                    alt={previewFile.name} 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  />
                ) : (
                  <div className="text-center space-y-4">
                    <div className="p-10 bg-white rounded-[2rem] inline-block shadow-sm">
                      <FileSearch className="w-16 h-16 text-slate-200" />
                    </div>
                    <p className="text-slate-500 font-bold">No visual preview available</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">This file type is supported for organization but cannot be rendered in the preview engine.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

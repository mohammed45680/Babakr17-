/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { 
  Plus, 
  FileText, 
  Users, 
  ClipboardCheck, 
  Activity, 
  TrendingUp, 
  Save, 
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Download,
  Printer,
  Edit2,
  X,
  Bell,
  Info,
  FileSpreadsheet
} from 'lucide-react';
import { Member, Meeting, Note } from './types';

interface AppNotification {
  id: string;
  message: string;
  type: 'info' | 'success';
  timestamp: string;
}

export default function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'observation' | 'technical' | 'field_result' | 'expectation'>('observation');
  const [noteContent, setNoteContent] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [hoveredMeetingId, setHoveredMeetingId] = useState<number | null>(null);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMeetings();
    fetchMembers();

    // WebSocket for notifications
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      let message = '';
      let type: 'info' | 'success' = 'info';

      if (data.type === 'NEW_NOTE') {
        message = `تمت إضافة ملاحظة جديدة في اجتماع: ${data.meetingTitle}`;
        type = 'info';
      } else if (data.type === 'MEETING_FINALIZED') {
        message = `تم اعتماد محضر الاجتماع: ${data.meetingTitle}`;
        type = 'success';
      }

      if (message) {
        const newNotification: AppNotification = {
          id: Math.random().toString(36).substr(2, 9),
          message,
          type,
          timestamp: data.timestamp
        };
        setNotifications(prev => [newNotification, ...prev].slice(0, 10));
        
        // Auto-remove toast after 5 seconds (but keep in list)
        // Actually let's just show them as toasts for now
      }
    };

    return () => socket.close();
  }, []);

  const translateRole = (role: string) => {
    const roles: Record<string, string> = {
      'Admin': 'مدير النظام',
      'Member': 'عضو لجنة',
      'Chairman': 'رئيس اللجنة',
      'Secretary': 'أمين السر',
      'Consultant': 'استشاري',
      'Engineer': 'مهندس',
      'Manager': 'مدير مشروع',
      'Contractor': 'مقاول'
    };
    return roles[role] || role;
  };

  const fetchMeetings = async () => {
    const res = await fetch('/api/meetings');
    const data = await res.json();
    setMeetings(data);
  };

  const fetchMembers = async () => {
    const res = await fetch('/api/members');
    const data = await res.json();
    setMembers(data);
    if (data.length > 0) setSelectedMemberId(data[0].id);
  };

  const fetchMeetingDetails = async (id: number) => {
    const res = await fetch(`/api/meetings/${id}`);
    const data = await res.json();
    setSelectedMeeting(data);
    
    // Smooth scroll to details on mobile
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('meeting-details')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const createMeeting = async () => {
    if (!newTitle) return;
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title: newTitle,
        start_date: newStartDate,
        end_date: newEndDate
      }),
    });
    const data = await res.json();
    fetchMeetings();
    fetchMeetingDetails(data.id);
    setIsCreating(false);
    setNewTitle('');
    setNewStartDate('');
    setNewEndDate('');
  };

  const startEditingMeeting = () => {
    if (!selectedMeeting) return;
    setEditTitle(selectedMeeting.title);
    setEditStartDate(selectedMeeting.start_date || '');
    setEditEndDate(selectedMeeting.end_date || '');
    setIsEditingMeeting(true);
  };

  const updateMeetingDetails = async () => {
    if (!selectedMeeting) return;
    try {
      await fetch(`/api/meetings/${selectedMeeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          start_date: editStartDate,
          end_date: editEndDate
        })
      });
      setIsEditingMeeting(false);
      fetchMeetingDetails(selectedMeeting.id);
      fetchMeetings();
    } catch (error) {
      console.error('Error updating meeting:', error);
    }
  };

  const addNote = async () => {
    if (!selectedMeeting || !noteContent || !selectedMemberId) return;
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_id: selectedMeeting.id,
        member_id: selectedMemberId,
        content: noteContent,
        type: activeTab,
      }),
    });
    setNoteContent('');
    fetchMeetingDetails(selectedMeeting.id);
  };

  const finalizeMeeting = async () => {
    if (!selectedMeeting) return;
    await fetch(`/api/meetings/${selectedMeeting.id}/finalize`, {
      method: 'PATCH',
    });
    fetchMeetingDetails(selectedMeeting.id);
    fetchMeetings();
  };

  const toggleAttendance = async (memberId: number) => {
    if (!selectedMeeting) return;
    await fetch(`/api/meetings/${selectedMeeting.id}/attendees/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    });
    fetchMeetingDetails(selectedMeeting.id);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToPDF = () => {
    if (!reportRef.current || !selectedMeeting) return;

    const element = reportRef.current;
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `محضر_اجتماع_${selectedMeeting.title}_${new Date(selectedMeeting.date).toLocaleDateString('ar-EG')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    // Temporarily add a class for PDF styling if needed
    element.classList.add('pdf-export');
    
    html2pdf().set(opt).from(element).save().then(() => {
      element.classList.remove('pdf-export');
    });
  };

  const exportToCSV = () => {
    if (meetings.length === 0) return;

    const headers = ['العنوان', 'التاريخ', 'الحالة', 'عدد الملاحظات'];
    const rows = meetings.map(m => [
      `"${m.title.replace(/"/g, '""')}"`,
      `"${new Date(m.date).toLocaleDateString('ar-EG')}"`,
      `"${m.status === 'final' ? 'نهائي' : 'مسودة'}"`,
      m.notes_count || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `قائمة_الاجتماعات_${new Date().toLocaleDateString('ar-EG')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <ClipboardCheck className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">نظام محاضر اجتماعات المشاريع</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all relative"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h4 className="font-bold text-slate-900">التنبيهات</h4>
                      <button onClick={() => setNotifications([])} className="text-[10px] text-indigo-600 hover:underline">مسح الكل</button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell size={32} className="mx-auto text-slate-200 mb-2" />
                          <p className="text-sm text-slate-400">لا توجد تنبيهات جديدة</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 text-right" dir="rtl">
                            <div className={`mt-1 p-1.5 rounded-lg h-fit ${n.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              {n.type === 'success' ? <CheckCircle size={14} /> : <Info size={14} />}
                            </div>
                            <div>
                              <p className="text-sm text-slate-700 leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleTimeString('ar-EG')}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
              <span>اجتماع جديد</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar - Meeting List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText size={20} className="text-indigo-600" />
              قائمة الاجتماعات
            </h2>
            <button 
              onClick={exportToCSV}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="تصدير القائمة كـ CSV"
            >
              <FileSpreadsheet size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {meetings.map((m) => (
              <div
                key={m.id}
                onClick={() => fetchMeetingDetails(m.id)}
                onMouseEnter={() => setHoveredMeetingId(m.id)}
                onMouseLeave={() => setHoveredMeetingId(null)}
                className={`w-full text-right p-4 rounded-xl border transition-all cursor-pointer relative group ${
                  selectedMeeting?.id === m.id 
                    ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-slate-900">{m.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                    m.status === 'final' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {m.status === 'final' ? 'نهائي' : 'مسودة'}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-xs text-slate-500">{new Date(m.date).toLocaleDateString('ar-EG')}</p>
                  <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                    <span>عرض التقرير</span>
                    <ChevronLeft size={14} />
                  </div>
                </div>

                {/* Quick View Tooltip */}
                <AnimatePresence>
                  {hoveredMeetingId === m.id && (
                    <motion.div
                      initial={{ opacity: 0, x: 10, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 10, scale: 0.95 }}
                      className="absolute right-full mr-4 top-0 w-64 bg-slate-900 text-white p-4 rounded-xl shadow-2xl z-50 pointer-events-none hidden lg:block"
                    >
                      <div className="text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wider">نظرة سريعة</div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <ClipboardCheck size={14} className="text-indigo-400" />
                          <span>{m.notes_count || 0} ملاحظات مسجلة</span>
                        </div>
                        {m.first_note ? (
                          <div className="text-xs text-slate-300 line-clamp-3 italic leading-relaxed">
                            "{m.first_note}"
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic">لا توجد ملاحظات بعد</div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{m.status === 'final' ? 'محضر معتمد' : 'بانتظار الاعتماد'}</span>
                        <ChevronLeft size={10} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content - Meeting Details */}
        <div id="meeting-details" className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedMeeting ? (
              <motion.div
                key={selectedMeeting.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Meeting Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center print:hidden">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-slate-900">{selectedMeeting.title}</h3>
                      {selectedMeeting.status === 'draft' && (
                        <button 
                          onClick={startEditingMeeting}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="تعديل بيانات الاجتماع"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-4 text-slate-500 mt-1 text-sm">
                      <p>تاريخ الاجتماع: {new Date(selectedMeeting.date).toLocaleDateString('ar-EG')}</p>
                      {selectedMeeting.start_date && <p>البداية: {new Date(selectedMeeting.start_date).toLocaleString('ar-EG')}</p>}
                      {selectedMeeting.end_date && <p>النهاية: {new Date(selectedMeeting.end_date).toLocaleString('ar-EG')}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedMeeting.status === 'draft' && (
                      <button 
                        onClick={finalizeMeeting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <CheckCircle size={18} />
                        <span>اعتماد المحضر</span>
                      </button>
                    )}
                    <button 
                      onClick={exportToPDF}
                      className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Download size={18} />
                      <span>تصدير PDF</span>
                    </button>
                    <button 
                      onClick={handlePrint}
                      className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Printer size={18} />
                      <span>طباعة</span>
                    </button>
                  </div>
                </div>

                {/* Note Entry Form (Only if draft) */}
                {selectedMeeting.status === 'draft' && (
                  <div className="p-6 border-b border-slate-100 bg-white print:hidden">
                    <div className="flex gap-4 mb-4 overflow-x-auto pb-2">
                      {[
                        { id: 'observation', label: 'ملاحظات الأعضاء', icon: Users },
                        { id: 'technical', label: 'الدراسة التقنية', icon: ClipboardCheck },
                        { id: 'field_result', label: 'المراقبة الميدانية', icon: Activity },
                        { id: 'expectation', label: 'التوقعات والنتائج', icon: TrendingUp },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                            activeTab === tab.id 
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <tab.icon size={16} />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">العضو</label>
                          <select 
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({translateRole(m.role)})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">المحتوى</label>
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="اكتب الملاحظة هنا..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                        />
                      </div>
                      <button 
                        onClick={addNote}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Save size={18} />
                        حفظ الملاحظة
                      </button>
                    </div>
                  </div>
                )}

                {/* Attendees Management (Only if draft) */}
                {selectedMeeting.status === 'draft' && (
                  <div className="p-6 border-b border-slate-100 bg-slate-50/30 print:hidden">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <Users size={16} className="text-indigo-600" />
                      تسجيل الحضور
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {members.map(m => {
                        const isPresent = selectedMeeting.attendees?.some(a => a.id === m.id);
                        return (
                          <div 
                            key={m.id}
                            onClick={() => toggleAttendance(m.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isPresent 
                                ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' 
                                : 'bg-white border-slate-200 hover:border-indigo-100'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                              isPresent ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                            }`}>
                              {isPresent && <CheckCircle size={14} className="text-white" />}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-800">{m.name}</div>
                              <div className="text-[10px] text-slate-500">{translateRole(m.role)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Display Notes / Report */}
                <div ref={reportRef} className="p-8 space-y-10 print:p-0 bg-white">
                  {/* Print Header */}
                  <div className="hidden print:block mb-12 border-b-4 border-double border-slate-900 pb-8">
                    <div className="flex justify-between items-center mb-10">
                      <div className="text-right space-y-1">
                        <div className="text-sm font-bold">المملكة العربية السعودية</div>
                        <div className="text-sm font-bold">إدارة المشاريع واللجان الفنية</div>
                      </div>
                      <div className="text-center">
                        <h1 className="text-3xl font-black text-slate-900 mb-2">نظام محاضر اجتماعات المشاريع</h1>
                        <div className="h-1.5 w-32 bg-indigo-600 mx-auto"></div>
                      </div>
                      <div className="text-left space-y-1">
                        <div className="text-xs text-slate-500">الرقم: ....................</div>
                        <div className="text-xs text-slate-500">التاريخ: {new Date(selectedMeeting.date).toLocaleDateString('ar-EG')}</div>
                      </div>
                    </div>
                    
                    <div className="text-center py-8 bg-slate-50 border-2 border-slate-200 rounded-2xl">
                      <h2 className="text-4xl font-black text-slate-900 mb-4">{selectedMeeting.title}</h2>
                      <div className="flex flex-wrap justify-center gap-x-12 gap-y-3 text-slate-700 font-bold text-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-sm font-normal">التاريخ:</span>
                          <span>{new Date(selectedMeeting.date).toLocaleDateString('ar-EG')}</span>
                        </div>
                        {selectedMeeting.start_date && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm font-normal">وقت البدء:</span>
                            <span>{new Date(selectedMeeting.start_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-sm font-normal">الحالة:</span>
                          <span className={selectedMeeting.status === 'final' ? 'text-emerald-700' : 'text-amber-700'}>
                            {selectedMeeting.status === 'final' ? 'محضر معتمد' : 'مسودة محضر'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Attendees List */}
                  <section>
                    <h4 className="text-lg font-bold text-slate-900 border-r-4 border-slate-900 pr-3 mb-6">قائمة الحضور</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {selectedMeeting.attendees?.map(m => (
                        <div key={m.id} className="flex flex-col border-b border-slate-100 pb-2">
                          <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                          <span className="text-xs text-slate-500">{translateRole(m.role)}</span>
                        </div>
                      ))}
                      {(!selectedMeeting.attendees || selectedMeeting.attendees.length === 0) && (
                        <p className="text-slate-400 italic text-sm col-span-full">لم يتم تسجيل حضور أي أعضاء.</p>
                      )}
                    </div>
                  </section>

                  {/* Section: Observations */}
                  <section>
                    <h4 className="text-lg font-bold text-slate-900 border-r-4 border-indigo-500 pr-3 mb-6">ملاحظات أعضاء اللجنة</h4>
                    <div className="space-y-4">
                      {selectedMeeting.notes?.filter(n => n.type === 'observation').map(note => (
                        <div key={note.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-indigo-700 text-sm">{note.member_name}</span>
                              <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                {translateRole(note.member_role || '')}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{note.content}</p>
                        </div>
                      ))}
                      {selectedMeeting.notes?.filter(n => n.type === 'observation').length === 0 && (
                        <p className="text-slate-400 italic text-sm">لا توجد ملاحظات مسجلة بعد.</p>
                      )}
                    </div>
                  </section>

                  {/* Section: Technical Study */}
                  <section>
                    <h4 className="text-lg font-bold text-slate-900 border-r-4 border-amber-500 pr-3 mb-6">الدراسة والتحليل التقني</h4>
                    <div className="space-y-4">
                      {selectedMeeting.notes?.filter(n => n.type === 'technical').map(note => (
                        <div key={note.id} className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                          <p className="text-slate-700 leading-relaxed">{note.content}</p>
                          <div className="mt-2 text-[10px] text-amber-700 font-bold uppercase">بواسطة: {note.member_name}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Section: Field Results */}
                  <section>
                    <h4 className="text-lg font-bold text-slate-900 border-r-4 border-emerald-500 pr-3 mb-6">نتائج المراقبة الميدانية</h4>
                    <div className="space-y-4">
                      {selectedMeeting.notes?.filter(n => n.type === 'field_result').map(note => (
                        <div key={note.id} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                          <p className="text-slate-700 leading-relaxed">{note.content}</p>
                          <div className="mt-2 text-[10px] text-emerald-700 font-bold uppercase">بواسطة: {note.member_name}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Section: Expectations */}
                  <section>
                    <h4 className="text-lg font-bold text-slate-900 border-r-4 border-rose-500 pr-3 mb-6">التوقعات والنتائج النهائية</h4>
                    <div className="space-y-4">
                      {selectedMeeting.notes?.filter(n => n.type === 'expectation').map(note => (
                        <div key={note.id} className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                          <p className="text-slate-700 leading-relaxed">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Signatures (Only for print) */}
                  <div className="hidden print:grid grid-cols-3 gap-8 mt-20 pt-10 border-t border-slate-200">
                    {selectedMeeting.attendees?.map(m => (
                      <div key={m.id} className="text-center">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-500">{translateRole(m.role)}</div>
                        <div className="mt-12 border-b border-slate-300 w-32 mx-auto"></div>
                        <div className="text-[10px] text-slate-400 mt-1">التوقيع</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>اختر اجتماعاً من القائمة أو أنشئ اجتماعاً جديداً</p>
              </div>
            )}
          </AnimatePresence>
        </div>
        {/* Floating Toasts */}
        <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {notifications.slice(0, 3).map((n) => (
              <motion.div
                key={`toast-${n.id}`}
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                className="pointer-events-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-80 flex gap-4 items-start"
              >
                <div className={`p-2 rounded-xl ${n.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {n.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 mb-1">تنبيه جديد</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                </div>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                  className="text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Create Meeting Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <h3 className="text-xl font-bold mb-4">إنشاء اجتماع جديد</h3>
                  <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">عنوان الاجتماع</label>
                  <input
                    autoFocus
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="مثال: اجتماع متابعة مشروع البرج السكني"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">تاريخ ووقت البدء</label>
                    <input
                      type="datetime-local"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">تاريخ ووقت الانتهاء</label>
                    <input
                      type="datetime-local"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={createMeeting}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    إنشاء
                  </button>
                  <button 
                    onClick={() => setIsCreating(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-lg font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {isEditingMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingMeeting(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-right"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">تعديل بيانات الاجتماع</h3>
                <button onClick={() => setIsEditingMeeting(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">عنوان الاجتماع</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">تاريخ ووقت البدء</label>
                    <input
                      type="datetime-local"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">تاريخ ووقت الانتهاء</label>
                    <input
                      type="datetime-local"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={updateMeetingDetails}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    <span>حفظ التعديلات</span>
                  </button>
                  <button 
                    onClick={() => setIsEditingMeeting(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-lg font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @media print {
          body { background: white !important; }
          main { display: block !important; padding: 0 !important; }
          .lg\\:col-span-4 { display: none !important; }
          .lg\\:col-span-8 { width: 100% !important; }
          .bg-white { border: none !important; box-shadow: none !important; }
          header { display: none !important; }
        }
        
        /* PDF Export specific styles */
        .pdf-export .print\\:block {
          display: block !important;
        }
        .pdf-export .print\\:grid {
          display: grid !important;
        }
        .pdf-export .print\\:p-0 {
          padding: 0 !important;
        }
        .pdf-export {
          padding: 20px !important;
          width: 210mm; /* A4 width */
          background: white !important;
        }
      `}</style>
    </div>
  );
}

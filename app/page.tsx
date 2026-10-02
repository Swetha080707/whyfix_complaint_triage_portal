'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Client Config (Replace with your env variables if needed)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Complaint {
  id: string;
  student_name: string;
  room_no: string;
  description: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Solved';
  created_at: string;
}

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);

  // Student Form State
  const [studentName, setStudentName] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [category, setCategory] = useState('Electrical');
  const [description, setDescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  // Admin Dashboard State
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [staffName, setStaffName] = useState<{ [key: string]: string }>({});
  const [staffPhone, setStaffPhone] = useState<{ [key: string]: string }>({});
  const [eta, setEta] = useState<{ [key: string]: string }>({});

  // Detect URL Query Parameter for Admin View (?role=admin)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIsAdmin(params.get('role') === 'admin');
    }
  }, []);

  // Fetch Complaints (Real-time updates)
  const fetchComplaints = async () => {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching complaints:', error);
    } else if (data) {
      setComplaints(data as Complaint[]);
    }
  };

  useEffect(() => {
    fetchComplaints();

    // Supabase Realtime Subscription
    const channel = supabase
      .channel('complaints-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => fetchComplaints()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Hybrid Priority Engine (Keyword Urgency Check)
  const calculatePriority = (text: string): 'High' | 'Medium' | 'Low' => {
    const urgentKeywords = ['fire', 'spark', 'leak', 'leakage', 'smoke', 'shock', 'emergency'];
    const lowerText = text.toLowerCase();
    const hasUrgentKeyword = urgentKeywords.some((word) => lowerText.includes(word));
    return hasUrgentKeyword ? 'High' : 'Medium';
  };

  // Voice Input Logic (Web Speech API)
  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech Recognition is not supported in your browser. Use Chrome!');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.start();
  };

  // Student Complaint Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const detectedPriority = calculatePriority(description);

    const { error } = await supabase.from('complaints').insert([
      {
        student_name: studentName || 'Anonymous Student',
        room_no: roomNo || 'Unspecified',
        category,
        description,
        priority: detectedPriority,
        status: 'Pending',
      },
    ]);

    if (error) {
      console.error('Insert error:', error);
      setSubmitStatus('❌ Failed to submit complaint. Try again.');
    } else {
      setSubmitStatus('✅ Complaint Registered Successfully!');
      setDescription('');
      setStudentName('');
      setRoomNo('');
      fetchComplaints();
    }
  };

  // Status Update Handler (Solved / In Progress)
  const handleStatusUpdate = async (id: string, newStatus: 'In Progress' | 'Solved') => {
    const { error } = await supabase
      .from('complaints')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('Status update error:', error);
    } else {
      fetchComplaints();
    }
  };

  // WhatsApp Alert Dispatcher
  const handleWhatsAppDispatch = (item: Complaint) => {
    const name = staffName[item.id] || 'Staff Member';
    const phone = staffPhone[item.id] || '';
    const estimatedTime = eta[item.id] || '1 Hour';

    if (!phone) {
      alert('Please enter a valid staff WhatsApp phone number!');
      return;
    }

    // Update status to In Progress
    handleStatusUpdate(item.id, 'In Progress');

    const message = `🚨 *WHYFIX MAINTENANCE TASK ALERT* 🚨\n\n` +
      `*Priority:* ${item.priority.toUpperCase()}\n` +
      `*Student Name:* ${item.student_name}\n` +
      `*Room/Location:* ${item.room_no}\n` +
      `*Category:* ${item.category}\n` +
      `*Issue:* ${item.description}\n\n` +
      `*Assigned To:* ${name}\n` +
      `*Resolution ETA:* ${estimatedTime}\n\n` +
      `Please inspect and resolve immediately!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const highPriorityCount = complaints.filter(
    (c) => c.priority === 'High' && c.status !== 'Solved'
  ).length;

  // ==========================================
  // 1. ADMIN DASHBOARD VIEW (FULL SCREEN WIDE)
  // ==========================================
  if (isAdmin) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
        <div className="max-w-[1800px] mx-auto space-y-8">
          
          {/* Top Header & Live Counters */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                WhyFix Admin Triage Portal
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Real-Time Complaint Escalation & Automated Staff Dispatch
              </p>
            </div>

            <div className="flex gap-4">
              <div className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="text-xs text-slate-400 font-medium uppercase">Total Complaints</div>
                  <div className="text-xl font-bold text-blue-400">{complaints.length}</div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <div className="text-xs text-slate-400 font-medium uppercase">High Priority</div>
                  <div className="text-xl font-bold text-red-400">{highPriorityCount}</div>
                </div>
              </div>
            </div>
          </header>

          {/* Full Screen Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {complaints.length === 0 ? (
              <div className="col-span-full text-center py-20 text-slate-500">
                No complaints registered yet.
              </div>
            ) : (
              complaints.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col p-6 rounded-2xl border backdrop-blur-md transition-all shadow-lg ${
                    item.status === 'Solved'
                      ? 'bg-slate-900/30 border-emerald-500/20 opacity-60'
                      : item.priority === 'High'
                      ? 'bg-red-950/20 border-red-500/50 shadow-red-500/5'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  {/* Badges Bar */}
                  <div className="flex justify-between items-center mb-4">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        item.priority === 'High'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {item.priority} Priority
                    </span>

                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold border ${
                        item.status === 'Solved'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : item.status === 'In Progress'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      ● {item.status || 'Pending'}
                    </span>
                  </div>

                  {/* Student Details Card */}
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 mb-4 space-y-1">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                      Student Info
                    </div>
                    <div className="text-sm font-semibold text-slate-200">
                      👤 {item.student_name || 'Anonymous Student'}
                    </div>
                    <div className="text-xs text-slate-400">
                      📍 Room / Block:{' '}
                      <span className="text-indigo-400 font-mono font-medium">
                        {item.room_no || 'Unspecified'}
                      </span>
                    </div>
                  </div>

                  {/* Category & Description */}
                  <div className="mb-6 flex-1">
                    <div className="text-xs text-slate-400 font-medium mb-1">
                      Category: <span className="text-slate-200">{item.category}</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                      "{item.description}"
                    </p>
                  </div>

                  {/* Action Workflow Controls */}
                  <div className="mt-auto pt-4 border-t border-slate-800/80 space-y-3">
                    {item.status !== 'Solved' && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Staff Name"
                            value={staffName[item.id] || ''}
                            onChange={(e) =>
                              setStaffName({ ...staffName, [item.id]: e.target.value })
                            }
                            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 p-2 rounded-lg focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="ETA (e.g. 1 Hr)"
                            value={eta[item.id] || ''}
                            onChange={(e) =>
                              setEta({ ...eta, [item.id]: e.target.value })
                            }
                            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 p-2 rounded-lg focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <input
                          type="text"
                          placeholder="WhatsApp Mobile (+91...)"
                          value={staffPhone[item.id] || ''}
                          onChange={(e) =>
                            setStaffPhone({ ...staffPhone, [item.id]: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 p-2 rounded-lg focus:outline-none focus:border-blue-500"
                        />

                        <button
                          onClick={() => handleWhatsAppDispatch(item)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                        >
                          📲 Assign & WhatsApp Alert
                        </button>

                        <button
                          onClick={() => handleStatusUpdate(item.id, 'Solved')}
                          className="w-full bg-slate-900 hover:bg-emerald-950 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/50 text-slate-400 font-medium py-2 px-4 rounded-xl transition text-xs flex items-center justify-center gap-2"
                        >
                          ✅ Mark as Solved
                        </button>
                      </>
                    )}

                    {item.status === 'Solved' && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 py-2.5 px-3 rounded-xl text-center">
                        <span className="text-xs text-emerald-400 font-semibold">
                          ✓ Issue Resolved & Closed
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. STUDENT COMPLAINT PORTAL VIEW
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-8 rounded-3xl shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            WhyFix Portal
          </h1>
          <p className="text-xs text-slate-400">
            Voice-Enabled Maintenance Triage System for Hostels & Campus
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
              Student Name
            </label>
            <input
              type="text"
              placeholder="e.g. Rahul Kumar"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          {/* Room / Block No */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
              Room / Block Number
            </label>
            <input
              type="text"
              placeholder="e.g. Room 102 - B Block"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition"
            >
              <option value="Electrical">Electrical (Spark, Switch, Fan)</option>
              <option value="Plumbing">Plumbing (Leakage, Tap, Pipe)</option>
              <option value="Carpentry">Carpentry (Door, Lock, Chair)</option>
              <option value="General">General Maintenance</option>
            </select>
          </div>

          {/* Description & Voice Button */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Complaint Description
              </label>
              <button
                type="button"
                onClick={startVoiceInput}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition flex items-center gap-1 ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
                }`}
              >
                🎙️ {isListening ? 'Listening...' : 'Speak Complaint'}
              </button>
            </div>

            <textarea
              rows={3}
              placeholder="Describe your issue or click 'Speak Complaint' to dictate..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-sm text-slate-200 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-lg shadow-blue-600/20"
          >
            Submit Complaint 🚀
          </button>
        </form>

        {submitStatus && (
          <p className="text-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 py-2.5 rounded-xl border border-emerald-500/20">
            {submitStatus}
          </p>
        )}

        <div className="pt-2 text-center border-t border-slate-800">
          <a
            href="/?role=admin"
            target="_blank"
            className="text-xs text-slate-500 hover:text-slate-300 underline transition"
          >
            Switch to Admin Portal ➔
          </a>
        </div>
      </div>
    </div>
  );
}
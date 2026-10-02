import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 1. GET: Complaints எடுப்பது
export async function GET() {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// 2. POST: புது Complaint + Hybrid Priority Calculation
export async function POST(req: Request) {
  const { description, category } = await req.json();

  if (!description) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }

  // A. Keyword Check (Urgency)
  const lowerText = description.toLowerCase();
  let priority = 'Low';

  if (lowerText.includes('spark') || lowerText.includes('fire') || lowerText.includes('leak') || lowerText.includes('urgent')) {
    priority = 'High';
  } else if (lowerText.includes('fan') || lowerText.includes('light') || lowerText.includes('tap') || lowerText.includes('water')) {
    priority = 'Medium';
  }

  // B. Frequency Check (அதே பிரச்சனை திரும்ப திரும்ப வந்தா High Priority)
  // ஒரே Description அல்லது Keywords இருக்குற பழைய Complaints-ஐ Count பண்ணுவோம்
  const { data: existingComplaints } = await supabase
    .from('complaints')
    .select('id')
    .ilike('description', `%${description.trim()}%`);

  if (existingComplaints && existingComplaints.length >= 2) {
    priority = 'High'; // 3-வது முறை சேரும்போது தானாகவே High Priority ஆயிடும்!
  }

  const { data, error } = await supabase
    .from('complaints')
    .insert([{ description, category, priority, status: 'Pending' }])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}

// 3. PATCH: Admin Staff Assign பண்ணி Time Set பண்றதுக்கு
export async function PATCH(req: Request) {
  const { id, assigned_staff, estimated_time, status } = await req.json();

  const { data, error } = await supabase
    .from('complaints')
    .update({ 
      assigned_staff, 
      estimated_time, 
      status: status || 'In Progress' 
    })
    .eq('id', id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data[0]);
}
export interface Member {
  id: number;
  name: string;
  role: string;
}

export interface Note {
  id: number;
  meeting_id: number;
  member_id: number | null;
  member_name?: string;
  member_role?: string;
  content: string;
  type: 'observation' | 'technical' | 'field_result' | 'expectation' | 'quick';
}

export interface Meeting {
  id: number;
  title: string;
  date: string;
  start_date?: string;
  end_date?: string;
  status: 'draft' | 'final';
  notes?: Note[];
  attendees?: Member[];
  notes_count?: number;
  first_note?: string;
}

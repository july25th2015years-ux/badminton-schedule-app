export type SlotStatus = 'circle' | 'triangle' | 'none';

export interface Attendance {
  id: string; // `${eventId}_${userName}`
  eventId: string;
  userName: string;
  
  // 午前
  morningStatus: SlotStatus;
  morningCondition?: string; // △の時は必須
  
  // 午後
  afternoonStatus: SlotStatus;
  afternoonCondition?: string; // △の時は必須
  
  // 過去データとの互換性用
  status?: 'circle' | 'triangle';
  condition?: string;

  updatedAt: string;
}

export interface PracticeEvent {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (例: "19:00")
  endTime: string; // HH:mm (例: "21:00")
  location: string; // 施設名・体育館名
  mapUrl?: string; // カスタムURL（任意、無ければlocationから自動生成）
  courtCount?: string; // 面数（例: "2面"）
  notes?: string; // 持ち物・会費等の備考
  createdAt: string;
  updatedAt: string;
}

export interface AttendeeDetail {
  userName: string;
  status: 'circle' | 'triangle';
  condition?: string;
}

export interface AttendanceStats {
  morningCircleCount: number;
  morningTriangleCount: number;
  afternoonCircleCount: number;
  afternoonTriangleCount: number;
  totalAttendeesCount: number; // 午前または午後に参加するユニーク人数
  morningAttendees: AttendeeDetail[];
  afternoonAttendees: AttendeeDetail[];
  allAttendees: AttendeeDetail[];
}

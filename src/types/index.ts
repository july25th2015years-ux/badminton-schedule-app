export type AttendanceStatus = 'circle' | 'triangle';

export interface Attendance {
  id: string;
  eventId: string;
  userName: string;
  status: AttendanceStatus;
  condition?: string; // △の時は必須
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

export interface AttendanceStats {
  circleCount: number;
  triangleCount: number;
  totalCount: number;
}

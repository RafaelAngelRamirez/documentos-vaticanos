export type UserRole = 'reader' | 'teacher';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  pictureUrl?: string | null;
  role: UserRole;
  teacherSince?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

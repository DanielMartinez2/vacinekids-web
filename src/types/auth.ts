export type UserRole = 'CUSTOMER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'DISABLED'
export interface AuthUser {
  id: string
  email: string
  role: UserRole
  status: UserStatus
}

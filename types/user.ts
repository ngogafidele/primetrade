export type UserRole = "admin" | "manager" | "staff"

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
}
